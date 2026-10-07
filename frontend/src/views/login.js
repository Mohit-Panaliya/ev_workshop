// auth/login.blade.php parity (guest layout).
import { login } from "../api.js";
import { logo } from "../ui.js";
import { icon } from "../icons.js";

export async function LoginView() {
  return `<div class="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-muted">
    <div class="mb-4">${logo("h-9 w-auto")}</div>
    <div class="w-full sm:max-w-md mt-2 px-6 py-6 bg-card shadow-sm overflow-hidden sm:rounded-lg border border-border">
      <div id="login-error" class="mb-4 hidden bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm"></div>
      <form id="login-form" method="POST" action="#/login">
        <div>
          <label class="block text-sm font-medium text-gray-700" for="username">Username</label>
          <input id="username" class="block mt-1 w-full rounded-md border border-gray-300 shadow-sm text-sm" type="text" name="username" required autofocus autocomplete="username">
        </div>
        <div class="mt-4">
          <label class="block text-sm font-medium text-gray-700" for="password">Password</label>
          <input id="password" class="block mt-1 w-full rounded-md border border-gray-300 shadow-sm text-sm" type="password" name="password" required autocomplete="current-password">
        </div>
        <div class="flex items-center justify-end mt-4">
          <button type="submit" class="ms-3 inline-flex items-center justify-center gap-2 rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">Log in</button>
        </div>
      </form>
    </div>
  </div>`;
}

LoginView.mounted = async (app) => {
  const form = app.querySelector("#login-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = app.querySelector("#login-error");
    err.classList.add("hidden");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await login(form.username.value.trim(), form.password.value);
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove("hidden");
      btn.disabled = false;
    }
  });
  void icon;
};
