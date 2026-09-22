const MODULE_ID = "lipatos-player-biography-edit";

const editState = new WeakMap();

function getActor(app) {
  return app?.actor ?? app?.document ?? null;
}

function isPlayerCharacterSheet(app) {
  const actor = getActor(app);
  if (game.user.isGM) return false;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "character") return false;
  if (!actor.isOwner) return false;
  return true;
}

function getBiographyTab(element) {
  return element?.querySelector?.('.tab[data-tab="biography"]')
    ?? element?.querySelector?.('section[data-tab="biography"]')
    ?? element?.querySelector?.('[data-application-part="biography"]');
}

function getToggleHost(tab) {
  const bio = tab?.querySelector?.('[data-target="system.details.biography.value"]');
  return bio?.querySelector?.(':scope > h3.icon')
    ?? bio?.querySelector?.('h3.icon')
    ?? bio?.querySelector?.('h3')
    ?? tab?.querySelector?.('h3');
}

function updateToggleVisual(app, toggle) {
  const editing = editState.get(app) === true;
  toggle.setAttribute("aria-checked", String(editing));
  toggle.classList.toggle("active", editing);
  toggle.title = editing ? "Завершить редактирование" : "Редактировать эту вкладку";

  const text = toggle.querySelector(".lipatos-bio-switch-text");
  if (text) text.textContent = editing ? "Готово" : "Редактировать";
}

async function rerenderBiography(app) {
  try {
    await app.render({ parts: ["biography"] });
  } catch (err) {
    console.warn(`${MODULE_ID} | Частичная перерисовка не удалась, выполняю полную`, err);
    await app.render({ force: true });
  }
}

function buildToggle(app, tab) {
  const host = getToggleHost(tab);
  if (!host) return null;

  let toggle = host.querySelector(".lipatos-bio-edit-toggle");
  if (toggle) {
    updateToggleVisual(app, toggle);
    return toggle;
  }

  toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "lipatos-bio-edit-toggle";
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-label", "Редактировать вкладку биографии");
  toggle.innerHTML = `
    <span class="lipatos-bio-switch-track" aria-hidden="true">
      <span class="lipatos-bio-switch-knob"></span>
    </span>
    <span class="lipatos-bio-switch-text">Редактировать</span>
  `;

  host.append(toggle);
  updateToggleVisual(app, toggle);

  for (const eventName of ["pointerdown", "mousedown", "mouseup"]) {
    toggle.addEventListener(eventName, event => event.stopPropagation());
  }

  toggle.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();

    const wasEditing = editState.get(app) === true;

    if (wasEditing) {
      const active = app.element?.ownerDocument?.activeElement;
      if (active && app.element?.contains?.(active) && !toggle.contains(active)) active.blur?.();
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    editState.set(app, !wasEditing);
    await rerenderBiography(app);
  });

  return toggle;
}

Hooks.on("dnd5e.prepareSheetContext", (sheet, partId, context) => {
  try {
    if (partId !== "biography") return;
    if (!isPlayerCharacterSheet(sheet)) return;
    context.editable = editState.get(sheet) === true;
  } catch (err) {
    console.error(`${MODULE_ID} | Ошибка подготовки контекста биографии`, err);
  }
});

Hooks.on("renderApplicationV2", (app, element) => {
  try {
    if (!isPlayerCharacterSheet(app)) return;
    const tab = getBiographyTab(element ?? app.element);
    if (!tab) return;
    buildToggle(app, tab);
  } catch (err) {
    console.error(`${MODULE_ID} | Ошибка добавления тумблера`, err);
  }
});

Hooks.on("closeApplicationV2", app => {
  editState.delete(app);
});
