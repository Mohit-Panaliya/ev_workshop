// auth/login.blade.php + layouts/guest.blade.php parity (exact classes).
import { login } from "../api.js";
import { logo } from "../ui.js";

export async function LoginView() {
  return `<div class="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-muted">
    <div class="mb-4"><a href="#/login">${logo("w-auto h-14")}</a></div>
    <div class="w-full sm:max-w-md mt-6 px-6 py-4 bg-white shadow-md overflow-hidden sm:rounded-lg">
      <div id="login-status" class="mb-4 hidden"></div>
      <form id="login-form" method="POST" action="#/login">
        <div>
          <label class="block text-sm font-medium text-gray-700" for="username">Username</label>
          <input id="username" class="block mt-1 w-full rounded-md border border-gray-300 shadow-sm text-sm" type="text" name="username" required autofocus autocomplete="username">
          <p class="mt-2 hidden text-sm text-red-600" data-err="username"></p>
        </div>
        <div class="mt-4">
          <label class="block text-sm font-medium text-gray-700" for="password">Password</label>
          <input id="password" class="block mt-1 w-full rounded-md border border-gray-300 shadow-sm text-sm" type="password" name="password" required autocomplete="current-password">
          <p class="mt-2 hidden text-sm text-red-600" data-err="password"></p>
        </div>
        <div class="block mt-4">
          <label for="remember_me" class="inline-flex items-center">
            <input id="remember_me" type="checkbox" class="rounded border border-gray-300 text-primary shadow-sm focus:ring-ring" name="remember">
            <span class="ms-2 text-sm text-gray-600">Remember me</span>
          </label>
        </div>
        <div class="flex items-center justify-end mt-4">
          <button type="submit" class="ms-3 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">Log in</button>
        </div>
      </form>
    </div>
  </div>`;
}

LoginView.mounted = async (app) => {
  const form = app.querySelector("#login-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = app.querySelector("#login-status");
    status.classList.add("hidden");
    app.querySelectorAll("[data-err]").forEach((p) => p.classList.add("hidden"));
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await login(form.username.value.trim(), form.password.value);
    } catch (ex) {
      status.textContent = ex.message;
      status.className = "mb-4 bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm";
      const perr = app.querySelector('[data-err="password"]');
      perr.textContent = ex.message;
      perr.classList.remove("hidden");
      btn.disabled = false;
    }
  });
};
