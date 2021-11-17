import './styles/panel.css';
import './styles/header.css';
import './styles/footer.css';

import {
  EventSystemAdapter,
  SystemPlugin,
  InteractionSystemAdapter,
  LogSystemAdapter,
} from './../../DTCD-SDK/index';

import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import 'gridstack/dist/h5/gridstack-dd-native';

import { toMountTemplates } from './utils/templates';
import emptyConfiguration from './utils/empty_configuration.json';
import defaultConfiguration from './utils/default_configuration.json';

document.selectTab = async function (tabNumber) {
  await Application.getSystem('WorkspaceSystem').setConfiguration(tabNumber);
  document
    .querySelectorAll('.workspace-footer-item')
    .forEach(tab => tab.classList.remove('active-tab'));
  document.querySelectorAll('.workspace-footer-item')[tabNumber - 1].classList.add('active-tab');
};

export class WorkspaceSystem extends SystemPlugin {
  // ---- PLUGIN PROPS ----
  #guid;
  #eventSystem;
  #interactionSystem;
  #logSystem;
  #emptyConfiguration;
  #defaultConfiguration;

  // ---- STATE ----
  #panels;
  #currentTitle;
  #currentID;
  #column;

  // ---- INTERNAL'S ----
  #grid;
  #editMode;
  #numberPanelIncrement;

  static getRegistrationMeta() {
    return {
      name: 'WorkspaceSystem',
      type: 'core',
      title: 'Система рабочего стола',
      version: '0.2.0',
      withDependencies: true,
      priority: 2,
    };
  }

  constructor(guid) {
    super();
    this.#guid = guid;
    this.#eventSystem = new EventSystemAdapter(guid);
    this.#eventSystem.registerPluginInstance(this);
    this.#interactionSystem = new InteractionSystemAdapter();
    this.#logSystem = new LogSystemAdapter(this.#guid, 'WorkspaceSystem');
    this.#defaultConfiguration = defaultConfiguration;
    this.#emptyConfiguration = emptyConfiguration;

    this.#panels = [];
    this.#editMode = false;

    toMountTemplates();

    // GRIDSTACK INSTANCE OPTIONS
    this.#grid = GridStack.init({
      styleInHead: true,
      float: true,
      draggable: {
        handle: '.handle-drag-of-panel',
      },
      resizable: {
        handles: 'e, se, s, sw, w, nw, n, ne',
      },
      margin: 0,
      staticGrid: true,
    });
    this.#numberPanelIncrement = 0;
  }

  get currentWorkspaceTitle() {
    return this.#currentTitle;
  }

  get currentWorkspaceID() {
    return this.#currentID;
  }

  get panels() {
    return this.#panels;
  }

  async init() {
    const parsedURL = new URLSearchParams(window.location.search);
    if (!parsedURL.has('workspace')) {
      this.#logSystem.debug('Initializing default workspace configuration');
      await this.setPluginConfig(this.#defaultConfiguration);
      return;
    }
    const id = parseInt(parsedURL.get('workspace'));
    this.#logSystem.debug(`Initializing configuration from url param with id:${id}`);
    await this.setConfiguration(id);
  }

  getPluginConfig() {
    const plugins = [];
    this.getGUIDList()
      .map(this.getInstance)
      .forEach(instance => {
        // ---- pluginInfo {guid, meta, config, position, undeletable}
        const guid = this.getGUID(instance);
        const meta = instance.constructor.getRegistrationMeta();
        const config =
          typeof instance.getPluginConfig === 'function' && instance !== this
            ? instance.getPluginConfig()
            : null;
        let position;
        let undeletable;

        const panel = this.#panels.find(panel => panel.instance === instance);
        if (panel) {
          position = panel?.widget.gridstackNode._orig;
          undeletable = panel.undeletable;
        }

        plugins.push({ guid, meta, config, position, undeletable });
      });
    return {
      id: this.#currentID,
      title: this.#currentTitle,
      column: this.#column,
      plugins,
    };
  }

  async setPluginConfig(config = {}) {
    this.resetWorkspace();
    this.#logSystem.info(
      `Setting workspace configuration (id:${config?.id}, title:${config?.title})`
    );
    // ---- COLUMN ----
    if (typeof config.column != 'undefined') this.setColumn(config.column);

    this.#currentTitle = config.title;
    this.#currentID = config.id;

    // ---- PLUGINS ----

    // ---- event-system-reset ----
    this.#eventSystem.setPluginConfig({ events: [], actions: [], subscriptions: [] });
    let subscriptions; // From workspace config for eventSystem process only subscriptions

    // ---- installing-plugins-from-config ----
    const GUIDMap = {};
    pluginsLoop: for (let plugin of config.plugins) {
      let { meta, config, undeletable, position = {}, guid } = plugin;
      switch (meta?.type) {
        case 'panel':
          const { w, h, x, y } = position;
          let widget;
          if (typeof meta.name !== 'undefined') {
            const pluginExists = this.getPlugin(meta.name);
            if (pluginExists) {
              this.#logSystem.debug('Creating empty cell');
              if (undeletable) widget = this.#createUndeletableCell(meta.name, w, h, x, y, false);
              else widget = this.createCell(meta.name, w, h, x, y, false);
            }
            const plugin = this.#panels.find(panel => panel.widget === widget).instance;
            const pluginGUID = this.getGUID(plugin);
            this.#logSystem.debug(`Mapping guid of ${meta.name} from ${guid} to ${pluginGUID}`);
            GUIDMap[guid] = pluginGUID;
          } else {
            this.createEmptyCell(w, h, x, y, false);
          }
          break;
        case 'core':
          const systemInstance = this.getSystem(meta.name);
          const systemGUID = this.getGUID(systemInstance);
          this.#logSystem.debug(`Mapped guid of ${meta.name} from ${guid} to ${systemGUID}`);
          GUIDMap[guid] = systemGUID;

          if (meta.name === 'EventSystem') {
            subscriptions = config.subscriptions;
            continue pluginsLoop;
          }
          if (meta.name === 'WorkspaceSystem') continue pluginsLoop;
          break;
        default:
          break;
      }

      const instance = this.getInstance(GUIDMap[guid]);
      if (instance && instance !== this && instance.setPluginConfig && config)
        await instance.setPluginConfig(config);
    }

    // EVENT-SYSTEM-MAPPING
    if (subscriptions)
      for (let sub of subscriptions) {
        const { event, action } = sub;
        event.guid = GUIDMap[event.guid];
        action.guid = GUIDMap[action.guid];
      }
    const actions = this.#eventSystem.actions;
    const events = this.#eventSystem.events;

    await this.getSystem('EventSystem').setPluginConfig({
      subscriptions,
      actions,
      events,
    });
    return true;
  }

  #createUndeletableCell(name, w, h, x, y, autoposition) {
    const widget = this.#grid.addWidget(
      `<div class="grid-stack-item">
      <div class="grid-stack-item-content handle-drag-of-panel">
        <div id="panel-${name}"></div>
      </div>
    </div>`,
      { x, y, w, h, autoposition }
    );
    const instance = this.installPlugin(name, `#panel-${name}`);
    const guid = this.getGUID(instance);
    const meta = this.getPlugin(name, 'panel').getRegistrationMeta();
    this.#panels.push({ meta, widget, instance, guid, undeletable: true });
    return widget;
  }

  async #downloadConfiguration(id) {
    this.#logSystem.debug(`Trying to download configuration with id:${id}`);
    try {
      const { data } = await this.#interactionSystem.GETRequest(`/v2/workspace/object?id=${id}`);
      this.#logSystem.debug(`Parsing configuration from response`);
      const content = data.content;
      content['id'] = data.id;
      content['title'] = data.title;
      return content;
    } catch (err) {
      this.#logSystem.error(
        `Error occured while downloading workspace configuration: ${err.message}`
      );
    }
  }

  resetWorkspace() {
    this.#logSystem.debug('Resetting current workspace configuration');
    this.#panels.forEach((plugin, idx) => {
      const { meta, widget, instance } = plugin;
      if (meta?.type !== 'core') {
        if (widget) this.#grid.removeWidget(widget);
        if (instance) this.uninstallPluginByInstance(instance);
      }
    });
    this.#panels = [];
    this.#logSystem.debug(`Clearing panels array`);
    this.setColumn();
  }

  async deleteConfiguration(id) {
    try {
      this.#logSystem.debug(`Trying to delete workspace configuration with id:${id}`);
      await this.#interactionSystem.DELETERequest('/v2/workspace/object', { data: [id] });
      this.#logSystem.info(`Deleted workspace configuration with id:${id}`);
    } catch (err) {
      this.#logSystem.error(`Error occured while deleting workspace configuration: ${err.message}`);
    }
  }

  async createEmptyConfiguration(title) {
    this.#logSystem.debug(`Trying to create new empty configuration with title:'${title}`);
    let tempConf = JSON.parse(JSON.stringify(this.#emptyConfiguration));
    tempConf.title = title;
    try {
      this.#logSystem.debug(`Sending request to create configurations`);
      await this.#interactionSystem.POSTRequest('/v2/workspace/object', [
        {
          title: title,
          content: tempConf,
        },
      ]);
      this.#logSystem.info(`Successfully created new configuration with title:'${title}'`);
    } catch (err) {
      this.#logSystem.error(
        `Error occured while downloading workspace configuration: ${err.message}`
      );
    }
  }

  async changeConfigurationTitle(id, newTitle) {
    this.#logSystem.debug(
      `Trying to change configuration title with id:${id} to value:'${newTitle}'`
    );
    try {
      await this.#interactionSystem.PUTRequest('/v2/workspace/object', [{ id, title: newTitle }]);
      this.#logSystem.info(`New title:'${newTitle}' was set to configuration with id:${id}`);
    } catch (err) {
      this.#logSystem.error(
        `Error occured while downloading workspace configuration: ${err.message}`
      );
    }
  }

  createEmptyCell(w = 4, h = 4, x = 0, y = 0, autoPosition = true) {
    //TODO: Prettify next assignments
    w = Number.isInteger(w) ? w : 4;
    h = Number.isInteger(h) ? h : 4;
    x = Number.isInteger(x) ? x : 0;
    y = Number.isInteger(y) ? y : 0;
    autoPosition = Boolean(autoPosition);

    const panelID = this.#numberPanelIncrement;

    // TODO: Replace on WEB-COMPONENT with style!
    const widget = this.#grid.addWidget(
      `
      <div class="grid-stack-item">
        <div class="grid-stack-item-content">
          <div class="handle-drag-of-panel gridstack-panel-header" style="visibility:${
            this.#editMode ? 'visible' : 'hidden'
          }">
            <div id="closePanelBtn-${panelID}" class="close-panel-button">
              <i  class="fas fa-lg fa-times"></i>
            </div>
          </div>
          <div class="gridstack-content-container${
            this.#editMode ? ' gridstack-panel-overlay' : ''
          }">
            <div id="panel-${panelID}">
            </div>
          </div>
        </div>
      </div>
    `,
      { x, y, w, h, autoPosition, id: panelID }
    );
    this.#panels.push({ widget, meta: { type: 'panel' } });

    // Panel select
    const selectEl = document.createElement('select');
    selectEl.classList = 'default-select-panel';
    selectEl.options[0] = new Option('Выбрать панель ↓');
    let nextOptionIndex = 1;
    this.getPanels().forEach(plug => {
      const { type, title, name } = plug;
      if (type === 'panel' && name !== 'MenuPanel' && name !== 'WorkspacePanel') {
        selectEl.options[nextOptionIndex] = new Option(title, name);
        nextOptionIndex++;
      }
    });

    // Creating instance of panel handler
    let instance;
    selectEl.onchange = evt => {
      this.#logSystem.info(`Selected plugin '${selectEl.value}' in empty cell with id ${panelID}`);
      const idCell = evt.target.parentElement.getAttribute('id');
      const workspaceCellID = idCell.split('-').pop();
      const meta = this.getPlugin(selectEl.value).getRegistrationMeta();
      instance = this.installPlugin(meta.name, `#panel-${workspaceCellID}`);
      let pluginInfo = this.#panels.find(panel => panel.widget === widget);
      Object.assign(pluginInfo, {
        instance,
        meta,
        undeletable: false,
      });
    };

    document.getElementById(`panel-${panelID}`).appendChild(selectEl);

    // closePanelBtn
    document.getElementById(`closePanelBtn-${panelID}`).addEventListener('click', evt => {
      this.#panels.splice(
        this.#panels.findIndex(plg => plg.widget !== widget),
        1
      );
      this.#grid.removeWidget(widget);
      if (instance) this.uninstallPluginByInstance(instance);
      this.#logSystem.info(`Widget with id ${panelID} was removed from workspace`);
    });

    this.#numberPanelIncrement++;
    this.#logSystem.info('Added empty widget');
    return widget;
  }

  createCell(panelName, w = 4, h = 4, x = 0, y = 0, autoPosition = true) {
    this.#logSystem.debug(
      `Adding panel-plugin widget with name:'${panelName}', w:${w},h:${h},x:${x},y:${y}, autoPosition:${autoPosition}`
    );
    this.#logSystem.info(`Adding panel widget with name:'${panelName}'`);
    const widget = this.createEmptyCell(w, h, x, y, autoPosition);
    const selectElement = widget.querySelector('select');
    const optionElements = selectElement.options;
    let options = [];
    for (let i = 0; i < optionElements.length; i++) {
      options.push(optionElements[i].value);
    }
    const tempArr = options.slice(1, options.length).toString();
    this.#logSystem.debug(`Available plugin list for widget: [${tempArr}]`);
    const panelIndex = options.indexOf(panelName);
    this.#logSystem.debug(`Setting select selected option index to '${panelIndex}`);
    selectElement.selectedIndex = panelIndex;
    this.#logSystem.debug(`Dispatching select event 'change' to trigger callback`);
    const changeEvent = new Event('change');
    selectElement.dispatchEvent(changeEvent);
    return widget;
  }

  deleteCell(cellID) {
    this.#logSystem.debug(`Trying to delete cell from workspace with id: ${cellID}`);
    const cellCloseBtn = document.querySelector(`#closePanelBtn-${cellID}`);
    if (!cellCloseBtn) {
      this.#logSystem.debug(`No cell element found on workspace with given id: ${cellID}`);
      return;
    }
    const event = new Event('click');
    this.#logSystem.debug(`Dispatching click event on cell's close button`);
    cellCloseBtn.dispatchEvent(event);
    this.#logSystem.info(`Deleted cell from workspace with id: ${cellID}`);
  }

  compactAllPanels() {
    this.#logSystem.info(`Compacting cells on workspace`);
    this.#grid.compact();
  }

  changeMode() {
    const panelHeaders = document.querySelectorAll('.gridstack-panel-header');
    panelHeaders.forEach(header => {
      header.style.visibility = this.#editMode ? 'hidden' : 'visible';
    });
    const panelContents = document.querySelectorAll('.gridstack-content-container');

    const overlayClass = 'gridstack-panel-overlay';
    panelContents.forEach(content => {
      this.#editMode ? content.classList.remove(overlayClass) : content.classList.add(overlayClass);
    });

    const margin = this.#editMode ? '0px' : '10px';
    this.#grid.batchUpdate();
    this.#grid.margin(margin);
    this.#grid.commit();
    this.#grid.setStatic(this.#editMode);
    this.#editMode = !this.#editMode;
    this.#logSystem.info(`Workspace edit mode turned ${this.#editMode ? 'on' : 'off'}`);
  }

  async getConfigurationList() {
    const response = await this.#interactionSystem.GETRequest('/v2/workspace/object');
    return response.data;
  }

  async setConfiguration(id) {
    if (typeof id != 'number') {
      this.#logSystem.error('Wrong argument type: must be integer');
      return;
    }
    const config = await this.#downloadConfiguration(id);
    return this.setPluginConfig(config);
  }

  async saveConfiguration() {
    this.#logSystem.info('Saving current configuration');
    this.#interactionSystem.PUTRequest('/v2/workspace/object', [
      {
        id: this.#currentID,
        title: this.#currentTitle,
        content: this.getPluginConfig(),
      },
    ]);
  }

  setDefaultConfiguration() {
    if (this.#editMode) this.changeMode();
    this.setPluginConfig(this.#defaultConfiguration);
  }

  setColumn(newColumn) {
    const column = typeof newColumn !== 'undefined' ? newColumn : 12;
    const head = document.head || document.getElementsByTagName('head')[0];

    let styleEl = head.querySelector('style#gridstack-custom-style');
    if (styleEl) head.removeChild(styleEl);

    this.#grid.column(column);
    this.#grid.el.querySelectorAll('.grid-stack-item').forEach(itemEl => {
      itemEl.style.minWidth = `${100 / column}%`;
    });
    styleEl = document.createElement('style');
    styleEl.setAttribute('id', 'gridstack-custom-style');
    styleEl.setAttribute('type', 'text/css');
    let style = '';

    for (let i = 0; i < column + 1; i++) {
      style += `
      .grid-stack > .grid-stack-item[gs-w='${i}']{width:${(100 / column) * i}%}
      .grid-stack > .grid-stack-item[gs-x='${i}']{left:${(100 / column) * i}%}
      .grid-stack > .grid-stack-item[gs-min-w='${i}']{min-width:${(100 / column) * i}%}
      .grid-stack > .grid-stack-item[gs-max-w='${i}']{max-width:${(100 / column) * i}%}
      `;
    }

    styleEl.innerHTML = style;
    head.appendChild(styleEl);
    this.#column = column;
  }
}
