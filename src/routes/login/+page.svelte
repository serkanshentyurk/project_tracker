<script>
  import { goto } from '$app/navigation';

  let password = '';
  let error = '';
  let loading = false;

  async function submit() {
    error = '';
    loading = true;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        goto('/');
      } else {
        error = data.error || 'Wrong password';
        password = '';
      }
    } catch {
      error = 'Connection failed';
    }
    loading = false;
  }
</script>

<div class="login-wrap">
  <div class="login-card">
    <div class="login-icon">🔬</div>
    <h1>Lab Tracker</h1>
    <p>Enter the password to continue.</p>

    <form on:submit|preventDefault={submit}>
      <input
        type="password"
        bind:value={password}
        placeholder="Password"
        autofocus
        disabled={loading}
      />
      {#if error}
        <div class="login-error">{error}</div>
      {/if}
      <button type="submit" class="login-btn" disabled={loading || !password}>
        {loading ? 'Checking…' : 'Log in'}
      </button>
    </form>
  </div>
</div>

<style>
  .login-wrap {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: var(--bg); padding: 20px;
  }
  .login-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.08);
    padding: 40px 36px; width: 100%; max-width: 380px; text-align: center;
  }
  .login-icon { font-size: 2.4rem; margin-bottom: 8px; }
  h1 { font-size: 1.3rem; font-weight: 700; margin-bottom: 4px; }
  p { color: var(--muted); font-size: .88rem; margin-bottom: 24px; }
  form { display: flex; flex-direction: column; gap: 12px; }
  input {
    padding: 10px 14px; border: 1.5px solid var(--border); border-radius: var(--r);
    font-size: .92rem; text-align: center; width: 100%;
  }
  input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-lt); }
  .login-btn {
    padding: 10px 18px; background: var(--accent); color: #fff; border: none;
    border-radius: var(--r); font-size: .88rem; font-weight: 600; cursor: pointer;
    transition: background .12s;
  }
  .login-btn:hover:not(:disabled) { background: #1d4ed8; }
  .login-btn:disabled { opacity: .5; cursor: not-allowed; }
  .login-error {
    color: var(--danger); font-size: .82rem; font-weight: 600;
    background: #fee2e2; padding: 6px 10px; border-radius: var(--r);
  }
</style>
