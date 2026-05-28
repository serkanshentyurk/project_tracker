"""
Analysis Service — FastAPI wrapper around behav_utils

Runs on the lab server alongside the data. The tracker's scan button
calls this service, which reads raw trial CSVs, runs behav_utils to
compute summary stats, and returns the results.

Endpoints:
    POST /scan          Scan a data directory → return all session stats
    POST /process-csv   Process a single uploaded CSV → return stats
    GET  /health        Status check

Usage:
    cd analysis-service
    pip install -r requirements.txt
    uvicorn app:app --host 0.0.0.0 --port 8100 --reload

The tracker calls http://localhost:8100/scan from its own /api/scan endpoint.
"""

import io
import json
import traceback
import math 
import tempfile
import numpy as np
from pathlib import Path
from datetime import date
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from behav_utils.data.filtering import filter_session
from behav_utils.analysis.session_features import compute_session_features


app = FastAPI(title="Lab Tracker Analysis Service", version="0.1.0")

# Allow the tracker (same machine or VPN) to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# MODELS
# =============================================================================

class ScanRequest(BaseModel):
    data_dir: str
    config_yaml: str  # raw YAML content, not a file path
    animal_ids: Optional[List[str]] = None  # filter to specific animals
    force: bool = False  # reprocess even if stats exist


class SessionResult(BaseModel):
    animal_id: str
    date: str  # YYYY-MM-DD
    stage: str
    distribution: Optional[str] = None
    folder: str  # relative path: "SS01/SOUND_CAT_SS01_2026_1_27"
    n_trials_total: int
    n_trials_valid: int
    metrics: Dict[str, Any]
    csv_path: str
    errors: List[str] = []


class ScanResponse(BaseModel):
    ok: bool
    sessions: List[SessionResult] = []
    errors: List[str] = []
    n_animals: int = 0
    n_sessions: int = 0


class HealthResponse(BaseModel):
    ok: bool
    behav_utils_available: bool
    version: str = "0.1.0"


# =============================================================================
# HELPERS
# =============================================================================

def _serialise_value(v):
    """Make a value JSON-serialisable."""
    if v is None: return None
    if isinstance(v, float) and math.isnan(v): return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return None if np.isnan(v) else float(v)
    if isinstance(v, np.ndarray):
        # Skip arrays (update_matrix etc.) — too large for session stats
        if v.size > 50:
            return None
        return v.tolist()
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, date):
        return v.isoformat()
    return v


def _clean_metrics(d):
    out = {}
    for k, v in d.items():
        if isinstance(v, float) and math.isnan(v):
            out[k] = None
        elif isinstance(v, (np.floating,)):
            out[k] = float(v)
        elif isinstance(v, (np.integer,)):
            out[k] = int(v)
        elif isinstance(v, (np.bool_,)):
            out[k] = bool(v)
        else:
            out[k] = v          # str, bool, list, None, int, float all pass
    return out


def _load_config_from_yaml(yaml_content: str):
    """Parse YAML config string into a ProjectConfig."""
    from behav_utils.config.schema import load_config
    import yaml

    # Write to temp file since load_config expects a path
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(yaml_content)
        f.flush()
        return load_config(f.name)


def _process_session(csv_path: Path, config) -> Dict[str, Any]:
    """
    Load a single CSV, apply masking, compute summary stats + plot data.
    Returns a dict with session info + metrics, or raises on failure.
    """
    from behav_utils.data.loading import load_session_csv, parse_date_from_path
    from behav_utils.data.filtering import filter_session
    from behav_utils.analysis.session_features import compute_session_features
    from behav_utils.analysis.psychometry import _bin_data, fit_psychometric
    from behav_utils.analysis.utils import cumulative_gaussian

    session_date = parse_date_from_path(
        str(csv_path.parent.name),
        config.file_structure.date_regex,
    )

    session = load_session_csv(
        str(csv_path), config,
        session_idx=0,
        session_date=session_date,
    )

    # ── Apply masking (per-session loader does NOT read masking_sessions) ──
    animal_id = session.metadata.animal_id or csv_path.parent.parent.name
    masking_dates = set()
    for ds in config.masking_sessions.get(animal_id, []):
        try:
            masking_dates.add(date(int(ds[:4]), int(ds[4:6]), int(ds[6:8])))
        except (ValueError, IndexError):
            pass
    if session.date in masking_dates:
        session.masking = True
        if session.trials.opto_on is not None and len(session.trials.opto_on):
            session.trials.opto_on = np.zeros_like(session.trials.opto_on, dtype=bool)

    # ── Session-type flags ────────────────────────────────────────────────
    is_masking = bool(session.masking)
    opto_arr = session.trials.opto_on
    opto_frac = float(opto_arr.mean()) if (opto_arr is not None and len(opto_arr)) else 0.0
    # "real opto" = laser delivered AND not a masking control. Masking has
    # already zeroed opto_on above, so this is belt-and-braces.
    is_opto = (opto_frac > 0.0) and not is_masking

    # ── Summary stats (filter: exclude aborts + opto trials by default) ───
    filtered = filter_session(session)
    stats = compute_session_features(filtered)

    # ── Psychometric data for client-side plotting ────────────────────────
    try:
        arrays = filtered.get_arrays()
        stim = arrays['stimuli']
        ch = arrays['choices']
        centres, means, counts = _bin_data(stim, ch, n_bins=8)
        stats['psych_bin_centres'] = centres.tolist()
        stats['psych_bin_means']   = [None if np.isnan(m) else float(m) for m in means]
        stats['psych_bin_counts']  = [int(c) for c in counts]

        fit = fit_psychometric(stim, ch)
        if fit.get('success') and not np.isnan(fit.get('mu', np.nan)):
            x_fit = np.linspace(-1, 1, 200)
            y_fit = cumulative_gaussian(
                x_fit, fit['mu'], fit['sigma'], fit['lapse_low'], fit['lapse_high'])
            stats['psych_curve_x'] = x_fit.tolist()
            stats['psych_curve_y'] = y_fit.tolist()
        else:
            stats['psych_curve_x'] = None
            stats['psych_curve_y'] = None
    except Exception:
        stats['psych_bin_centres'] = None
        stats['psych_bin_means']   = None
        stats['psych_bin_counts']  = None
        stats['psych_curve_x']     = None
        stats['psych_curve_y']     = None

    # ── Inject the session-type flags into metrics ────────────────────────
    stats['is_masking'] = is_masking
    stats['is_opto'] = is_opto
    stats['opto_frac'] = opto_frac

    stage = session.stage or ''
    dist = session.distribution or ''
    sess_date = session.date

    return {
        'animal_id': animal_id,
        'date': sess_date.isoformat() if isinstance(sess_date, date) else str(sess_date),
        'stage': stage,
        'distribution': dist,
        'folder': f"{csv_path.parent.parent.name}/{csv_path.parent.name}",
        'n_trials_total': session.n_trials,
        'n_trials_valid': int(np.sum(~np.isnan(session.trials.choice))),
        'metrics': _clean_metrics(stats),
        'csv_path': str(csv_path),
    }


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/health", response_model=HealthResponse)
async def health():
    """Check if the service is running and behav_utils is importable."""
    try:
        import behav_utils
        return HealthResponse(ok=True, behav_utils_available=True)
    except ImportError:
        return HealthResponse(ok=True, behav_utils_available=False)


@app.post("/scan", response_model=ScanResponse)
async def scan_directory(req: ScanRequest):
    """
    Scan a data directory and process all raw trial CSVs.

    Expects the directory structure:
        data_dir / {animal_id} / {session_dir} / trial_summary*.csv

    The config_yaml content defines column mappings, task parameters, etc.
    """
    import glob

    data_dir = Path(req.data_dir)
    if not data_dir.exists():
        raise HTTPException(status_code=400, detail=f"Directory not found: {req.data_dir}")

    try:
        config = _load_config_from_yaml(req.config_yaml)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid config: {e}")

    # Override data_dir in config
    config.file_structure.data_dir = str(data_dir)

    sessions = []
    errors = []

    # Find animal directories
    animal_dirs = sorted([
        d for d in data_dir.iterdir()
        if d.is_dir() and not d.name.startswith('.')
    ])

    if req.animal_ids:
        animal_dirs = [d for d in animal_dirs if d.name in req.animal_ids]

    for animal_dir in animal_dirs:
        print(f"[scan] Processing animal: {animal_dir.name}", flush=True)
        # Find session directories
        session_dirs = sorted([
            d for d in animal_dir.iterdir()
            if d.is_dir() and not d.name.startswith('.')
        ])

        for sess_dir in session_dirs:
            # Find trial CSV
            pattern = config.file_structure.behaviour_file
            csv_files = sorted(glob.glob(str(sess_dir / pattern)))

            if not csv_files:
                continue

            csv_path = Path(csv_files[0])

            try:
                result = _process_session(csv_path, config)
                sessions.append(SessionResult(**result))
            except Exception as e:
                err_msg = f"{animal_dir.name}/{sess_dir.name}: {e}"
                errors.append(err_msg)
                continue

    # Sort by animal then date
    sessions.sort(key=lambda s: (s.animal_id, s.date))

    return ScanResponse(
        ok=True,
        sessions=sessions,
        errors=errors,
        n_animals=len(set(s.animal_id for s in sessions)),
        n_sessions=len(sessions),
    )


@app.post("/process-csv")
async def process_single_csv(
    file: UploadFile = File(...),
    config_yaml: str = "",
):
    """
    Process a single uploaded trial CSV.

    Returns computed stats for that session. Useful for quick one-off
    processing or testing.
    """
    if not config_yaml:
        raise HTTPException(status_code=400, detail="config_yaml is required")

    try:
        config = _load_config_from_yaml(config_yaml)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid config: {e}")

    # Save uploaded file to temp location
    content = await file.read()
    with tempfile.NamedTemporaryFile(
        mode='wb', suffix='.csv', delete=False, dir=tempfile.gettempdir()
    ) as f:
        f.write(content)
        tmp_path = Path(f.name)

    try:
        result = _process_session(tmp_path, config)
        return {"ok": True, "session": result}
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Processing failed: {e}")
    finally:
        tmp_path.unlink(missing_ok=True)
