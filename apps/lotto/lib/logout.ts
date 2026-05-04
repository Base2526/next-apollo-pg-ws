export function logout() {
  // Remove token from cookie
  document.cookie = "auth_token=; Max-Age=0; path=/;";
  // Remove from localStorage
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  window.location.href = "/login";
}
