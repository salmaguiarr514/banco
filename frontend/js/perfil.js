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

  // Cargar datos del perfil
  if (loadPerfilBtn) {
    loadPerfilBtn.addEventListener("click", async () => {
      try {
        const user     = JSON.parse(localStorage.getItem("user") || "{}");
        const cuentas  = await apiFetch("/cuentas/saldo");
        const cuenta   = cuentas[0] || {};
        const perfilData = document.getElementById("perfilData");
        if (perfilData) {
          perfilData.innerHTML = `
            <div class="profile-card">
              <div class="info-row"><span class="label">Nombre completo</span><span class="value">${user.nombre || ""} ${user.apellido || ""}</span></div>
              <div class="info-row"><span class="label">Email</span><span class="value">${user.email || ""}</span></div>
            </div>`;
        }
        editAliasBtn?.classList.remove("hidden");
        editPerfilBtn?.classList.remove("hidden");
        changePasswordBtn?.classList.remove("hidden");
      } catch {}
    });
  }

  // Modal alias
  editAliasBtn?.addEventListener("click", () => aliasModal?.classList.remove("hidden"));
  cancelAliasBtn?.addEventListener("click", () => aliasModal?.classList.add("hidden"));
  aliasModal?.addEventListener("click", e => { if (e.target === aliasModal) aliasModal.classList.add("hidden"); });

  // Modal perfil
  editPerfilBtn?.addEventListener("click",  () => perfilModal?.classList.remove("hidden"));
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
        await apiFetch("/auth/perfil", { method: "PUT", body: JSON.stringify({ alias: newAlias }) });
        showToast("Alias actualizado con éxito", 3000, "success");
        document.getElementById("newAliasInput").value = "";
        aliasModal?.classList.add("hidden");
        loadPerfilBtn?.click();
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
            alias:     document.getElementById("perfilAlias")?.value    || undefined,
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
        loadPerfilBtn?.click();
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
