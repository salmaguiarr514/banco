document.addEventListener("DOMContentLoaded", () => {
  const loadPerfilBtn     = document.getElementById("loadPerfilBtn");
  const editPerfilBtn     = document.getElementById("editPerfilBtn");
  const editAliasBtn      = document.getElementById("editAliasBtn");
  const aliasForm         = document.getElementById("aliasForm");
  const cancelAliasBtn    = document.getElementById("cancelAliasBtn");
  const perfilForm        = document.getElementById("perfilForm");
  const cancelPerfilBtn   = document.getElementById("cancelPerfilBtn");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const passwordForm      = document.getElementById("passwordForm");
  const cancelPasswordBtn = document.getElementById("cancelPasswordBtn");
  const aliasModal        = document.getElementById("aliasModal");
  const perfilModal       = document.getElementById("perfilModal");
  const passwordModal     = document.getElementById("passwordModal");

  const openPerfilModal = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const el = id => document.getElementById(id);
    if (el("perfilNombre"))    el("perfilNombre").value    = user.nombre    || "";
    if (el("perfilApellido"))  el("perfilApellido").value  = user.apellido  || "";
    if (el("perfilTelefono"))  el("perfilTelefono").value  = user.telefono  || "";
    if (el("perfilDireccion")) el("perfilDireccion").value = user.direccion || "";
    perfilModal?.classList.remove("hidden");
  };

  // Cargar datos del perfil — ahora abre el modal directamente
  loadPerfilBtn?.addEventListener("click", openPerfilModal);
  editPerfilBtn?.addEventListener("click", openPerfilModal);

  // Modal alias
  editAliasBtn?.addEventListener("click", () => aliasModal?.classList.remove("hidden"));
  cancelAliasBtn?.addEventListener("click", () => aliasModal?.classList.add("hidden"));
  aliasModal?.addEventListener("click", e => { if (e.target === aliasModal) aliasModal.classList.add("hidden"); });

  // Modal perfil
  cancelPerfilBtn?.addEventListener("click", () => perfilModal?.classList.add("hidden"));
  perfilModal?.addEventListener("click", e => { if (e.target === perfilModal) perfilModal.classList.add("hidden"); });

  // Modal contraseña
  changePasswordBtn?.addEventListener("click", () => passwordModal?.classList.remove("hidden"));
  cancelPasswordBtn?.addEventListener("click",  () => passwordModal?.classList.add("hidden"));
  passwordModal?.addEventListener("click", e => { if (e.target === passwordModal) passwordModal.classList.add("hidden"); });

  // Guardar alias
  if (aliasForm) {
    aliasForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const newAlias = document.getElementById("newAliasInput")?.value;
      formLoad(aliasForm, true);
      try {
        const data = await apiFetch("/auth/perfil", { method: "PUT", body: JSON.stringify({ alias: newAlias }) });
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          if (typeof actualizarIndicadorPerfil === "function") actualizarIndicadorPerfil();
        }
        showToast("Alias actualizado con éxito", 3000, "success");
        document.getElementById("newAliasInput").value = "";
        aliasModal?.classList.add("hidden");
      } catch (error) {
        showToast(error.message?.includes("409") ? "El alias ya está en uso." : error.message || "Error al cambiar alias", 4000, "error");
      } finally {
        formLoad(aliasForm, false);
      }
    });
  }

  // Guardar perfil
  if (perfilForm) {
    perfilForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      formLoad(perfilForm, true);
      try {
        const data = await apiFetch("/auth/perfil", {
          method: "PUT",
          body: JSON.stringify({
            nombre:    document.getElementById("perfilNombre")?.value   || undefined,
            apellido:  document.getElementById("perfilApellido")?.value || undefined,
            telefono:  document.getElementById("perfilTelefono")?.value || undefined,
            direccion: document.getElementById("perfilDireccion")?.value || undefined,
          }),
        });
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          if (typeof actualizarIndicadorPerfil === "function") actualizarIndicadorPerfil();
        }
        showToast("Perfil actualizado correctamente", 3000, "success");
        perfilModal?.classList.add("hidden");
      } catch (error) {
        showToast(error.message || "Error al actualizar perfil", 4000, "error");
      } finally {
        formLoad(perfilForm, false);
      }
    });
  }

  // Guardar contraseña
  if (passwordForm) {
    passwordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      formLoad(passwordForm, true);
      try {
        await apiFetch("/auth/password", {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: document.getElementById("currentPassword").value,
            newPassword:     document.getElementById("newPassword").value,
          }),
        });
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        passwordModal?.classList.add("hidden");
        showToast("Contraseña actualizada", 3000, "success");
      } catch (error) {
        showToast(error.message || "Error al cambiar contraseña", 4000, "error");
      } finally {
        formLoad(passwordForm, false);
      }
    });
  }
});
