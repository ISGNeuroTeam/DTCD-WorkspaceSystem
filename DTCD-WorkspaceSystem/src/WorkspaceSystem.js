import './styles/panel.css';
import './styles/modal.css';

import {
  EventSystemAdapter,
  SystemPlugin,
  InteractionSystemAdapter,
  LogSystemAdapter,
} from './../../DTCD-SDK/index';

import 'gridstack/dist/gridstack.min.css';
import { GridStack } from 'gridstack';
import 'gridstack/dist/h5/gridstack-dd-native';

import { toMountTemplates } from './utils/templates';
import gridstackOptions from './utils/gridstackOptions';
import emptyConfiguration from './utils/empty_configuration.json';
import defaultConfiguration from './utils/default_configuration.json';

import { version } from './../package.json';

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
  #modalInstance;

  static getRegistrationMeta() {
    return {
      name: 'WorkspaceSystem',
      type: 'core',
      title: 'Система рабочего стола',
      version,
      withDependencies: true,
      priority: 2,
    };
  }

  constructor(guid) {
    super();
    this.#guid = guid;
    this.#eventSystem = new EventSystemAdapter('0.4.0', guid);
    this.#eventSystem.registerPluginInstance(this, ['WorkspaceCellClicked']);
    this.#interactionSystem = new InteractionSystemAdapter('0.4.0');
    this.#logSystem = new LogSystemAdapter('0.5.0', this.#guid, 'WorkspaceSystem');
    this.#defaultConfiguration = defaultConfiguration;
    this.#emptyConfiguration = emptyConfiguration;

    this.#panels = [];
    this.#editMode = false;
    this.#modalInstance = null;

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

  get currentWorkspaceColumn() {
    return this.#column;
  }

  getFormSettings() {
    return {
      fields: [
        {
          component: 'title',
          propValue: 'Настройки рабочего стола',
        },
        {
          component: 'text',
          propName: 'title',
          attrs: {
            label: 'Название рабочего стола',
            required: true,
          },
        },
        {
          component: 'text',
          propName: 'column',
          attrs: {
            type: 'number',
            label: 'Количество колонок',
          },
        },
        {
          component: 'subtitle',
          propValue: 'Перемещение панелей',
        },
        {
          component: 'switch',
          handler: {
            event: 'input',
            callback: this.changeMode.bind(this),
          },
        },
        // {
        //   component: 'button',
        //   content: 'Добавить панель',
        //   handler: {
        //     event: 'click',
        //     callback: this.createEmptyCell.bind(this),
        //   },
        // },
      ],
    };
  }

  setFormSettings(config) {
    const { title, column } = config;
    this.#currentTitle = title;
    this.setColumn(column);
    this.saveConfiguration();
  }

  async init() {
    return;
    toMountTemplates();
    const parsedURL = new URLSearchParams(window.location.search);
    if (!parsedURL.has('workspace')) {
      this.#logSystem.debug('Initializing default workspace configuration');
      await this.setPluginConfig(this.#defaultConfiguration);
      return;
    }
    const id = parsedURL.get('workspace');
    this.#logSystem.debug(`Initializing configuration from url param with id:${id}`);
    await this.setConfiguration(id);
  }

  mountDashboardContainer(element) {
    if (!(element instanceof HTMLElement)) {
      this.#logSystem.debug('The element is not an HTMLElement');
      return false;
    }

    if (!document.body.contains(element)) {
      this.#logSystem.debug('The element is not contained in the DOM');
      return false;
    }

    element.innerHTML = `<div class="grid-stack"></div>`;
    this.#grid = GridStack.init(gridstackOptions);

    const workspaceID = history.state.workspaceID;
    this.setConfiguration(workspaceID);

    return true;
  }

  getPluginConfig() {
    const plugins = [];
    Object.values(Application.systems).forEach(system => {
      // ---- pluginInfo {guid, meta, config, position, undeletable}
      const guid = this.getGUID(system);
      const meta = system.constructor.getRegistrationMeta();
      const config =
        typeof system.getPluginConfig === 'function' && system !== this
          ? system.getPluginConfig()
          : null;

      plugins.push({ guid, meta, config });
    });

    this.#panels
      .filter(panel => panel.instance)
      .forEach(panel => {
        const guid = panel.guid;
        const meta = panel.meta;
        const config =
          typeof panel.instance.getPluginConfig === 'function'
            ? panel.instance.getPluginConfig()
            : null;

        let position = panel?.widget.gridstackNode._orig;
        let undeletable = panel.undeletable;

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

    let eventSystemConfig = {};

    // ---- installing-plugins-from-config ----
    const GUIDMap = {};
    pluginsLoop: for (let plugin of config.plugins) {
      let { meta, config, undeletable, position = {}, guid } = plugin;
      switch (meta?.type) {
        case 'panel':
          if (['MenuPanel', 'ConfigEditorPanel'].includes(meta.name)) continue pluginsLoop;
          const { w, h, x, y } = position;
          let widget;
          if (typeof meta.name !== 'undefined') {
            const pluginExists = this.getPlugin(meta.name, meta.version);
            if (pluginExists) {
              this.#logSystem.debug('Creating empty cell');
              if (undeletable)
                widget = this.#createUndeletableCell({
                  name: meta.name,
                  version: meta.version,
                  w,
                  h,
                  x,
                  y,
                  autoposition: false,
                });
              else
                widget = this.createCell({
                  name: meta.name,
                  version: meta.version,
                  w,
                  h,
                  x,
                  y,
                  autoPosition: false,
                });
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
          const systemInstance = this.getSystem(meta.name, meta.version);
          const systemGUID = this.getGUID(systemInstance);
          this.#logSystem.debug(`Mapped guid of ${meta.name} from ${guid} to ${systemGUID}`);
          GUIDMap[guid] = systemGUID;

          if (meta.name === 'EventSystem') {
            eventSystemConfig = config;
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
    if (eventSystemConfig.hasOwnProperty('subscriptions'))
      for (let sub of eventSystemConfig.subscriptions) {
        const { event, action } = sub;
        event.guid = GUIDMap[event.guid];
        action.guid = GUIDMap[action.guid];
      }

    await this.#eventSystem.setPluginConfig(eventSystemConfig);
    return true;
  }

  async downloadConfiguration(id) {
    this.#logSystem.debug(`Trying to download configuration with id:${id}`);
    try {
      const { data } = await this.#interactionSystem.GETRequest(
        `/mock_server/v1/workspace/object?id=${id}`
      );
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
    this.#panels.forEach(plugin => {
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
      await this.#interactionSystem.DELETERequest('/mock_server/v1/workspace/object', {
        data: [id],
      });
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
      await this.#interactionSystem.POSTRequest('/mock_server/v1/workspace/object', [
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

  async importConfiguration(configuration) {
    this.#logSystem.debug(`Trying to import configuration with title:'${configuration.title}`);
    try {
      this.#logSystem.debug(`Sending request to import configurations`);
      await this.#interactionSystem.POSTRequest('/mock_server/v1/workspace/object', [
        {
          title: configuration.title,
          content: configuration,
        },
      ]);
      this.#logSystem.info(
        `Successfully imported configuration with title:'${configuration.title}'`
      );
    } catch (err) {
      this.#logSystem.error(
        `Error occured while importing workspace configuration: ${err.message}`
      );
    }
  }

  async changeConfigurationTitle(id, title) {
    this.#logSystem.debug(`Trying to change configuration title with id:${id} to value:'${title}'`);
    try {
      await this.#interactionSystem.PUTRequest('/mock_server/v1/workspace/object', [
        {
          id,
          title,
        },
      ]);

      this.#logSystem.info(`New title:'${title}' was set to configuration with id:${id}`);
    } catch (err) {
      this.#logSystem.error(
        `Error occured while downloading workspace configuration: ${err.message}`
      );
    }
  }

  #createUndeletableCell({ name, version, w, h, x, y, autoposition }) {
    const widget = this.#grid.addWidget(
      `<div class="grid-stack-item">
      <div class="grid-stack-item-content handle-drag-of-panel">
        <div id="panel-${name}"></div>
      </div>
    </div>`,
      { x, y, w, h, autoposition }
    );
    const instance = this.installPanel({ name, version, selector: `#panel-${name}` });
    const guid = this.getGUID(instance);
    widget.addEventListener('click', () =>
      this.#eventSystem.publishEvent('WorkspaceCellClicked', { guid })
    );
    const meta = this.getPlugin(name, version).getRegistrationMeta();
    this.#panels.push({ meta, widget, instance, guid, undeletable: true });
    return widget;
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
          <div class="handle-drag-of-panel gridstack-panel-header" style="display:${
            this.#editMode ? 'flex' : 'none'
          }">
            <div id="closePanelBtn-${panelID}" class="close-panel-button">
              <span class="FontIcon name_closeBig size_lg"></span>           
            </div>
            <span class="drag-panel-button FontIcon name_move size_lg"></span>  
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
    this.getPanels()
      .filter(plugin => Object.getPrototypeOf(plugin.plugin).name === 'PanelPlugin')
      .forEach(plug => {
        const { type, title, name, version } = plug;
        if (type === 'panel') {
          selectEl.options[nextOptionIndex] = new Option(
            `${title} ${version}`,
            JSON.stringify({ name, version })
          );
          nextOptionIndex++;
        }
      });

    // Creating instance of panel handler
    let instance;
    selectEl.onchange = evt => {
      const { name, version } = JSON.parse(selectEl.value);
      this.#logSystem.info(`Selected plugin '${name} ${version}' in empty cell with id ${panelID}`);
      const idCell = evt.target.parentElement.getAttribute('id');
      const workspaceCellID = idCell.split('-').pop();
      const meta = this.getPlugin(name, version).getRegistrationMeta();
      instance = this.installPanel({
        name: meta.name,
        version,
        selector: `#panel-${workspaceCellID}`,
      });
      const guid = this.getGUID(instance);
      widget.addEventListener('click', e => {
        e.stopPropagation();
        this.#eventSystem.publishEvent('WorkspaceCellClicked', { guid });
      });
      let pluginInfo = this.#panels.find(panel => panel.widget === widget);
      Object.assign(pluginInfo, {
        instance,
        guid,
        meta,
        undeletable: false,
      });
    };

    document.getElementById(`panel-${panelID}`).appendChild(selectEl);

    // closePanelBtn
    document.getElementById(`closePanelBtn-${panelID}`).addEventListener('click', evt => {
      this.#panels.splice(
        this.#panels.findIndex(plg => plg.widget === widget),
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

  createCell({ name, version, w = 4, h = 4, x = 0, y = 0, autoPosition = true }) {
    this.#logSystem.debug(
      `Adding panel-plugin widget with name:'${name}', version:${version}, w:${w},h:${h},x:${x},y:${y}, autoPosition:${autoPosition}`
    );
    this.#logSystem.info(`Adding panel widget with name: '${name}', version: '${version}'`);
    const widget = this.createEmptyCell(w, h, x, y, autoPosition);
    const selectElement = widget.querySelector('select');
    const optionElements = selectElement.options;
    let options = [];
    for (let i = 0; i < optionElements.length; i++) {
      options.push(optionElements[i].value);
    }
    options = options.slice(1, options.length);
    this.#logSystem.debug(`Available plugin list for widget: [${options}]`);
    const panelIndex =
      options.indexOf(
        options.find(option => {
          const optionObject = JSON.parse(option);
          return optionObject.name === name && optionObject.version === version;
        })
      ) + 1;
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
    const panelBorder = document.querySelectorAll('.grid-stack-item-content');
    panelBorder.forEach(content => {
      content.style.border = this.#editMode ? '2px solid var(--background_secondary)' : '2px solid var(--button_primary)';
    });

    const panelHeaders = document.querySelectorAll('.gridstack-panel-header');
    panelHeaders.forEach(header => {
      header.style.display = this.#editMode ? 'none' : 'flex';
    });
    const panelContents = document.querySelectorAll('.gridstack-content-container');

    const overlayClass = 'gridstack-panel-overlay';
    panelContents.forEach(content => {
      this.#editMode ? content.classList.remove(overlayClass) : content.classList.add(overlayClass);
    });

    const margin = this.#editMode ? '0px' : '2px';
    this.#grid.batchUpdate();
    this.#grid.margin(margin);
    this.#grid.commit();
    this.#grid.setStatic(this.#editMode);
    this.#editMode = !this.#editMode;
    this.#logSystem.info(`Workspace edit mode turned ${this.#editMode ? 'on' : 'off'}`);
  }

  async getConfigurationList() {
    const response = await this.#interactionSystem.GETRequest('/mock_server/v1/workspace/object');
    return response.data;
  }

  async setConfiguration(id) {
    const config = await this.downloadConfiguration(id);
    return this.setPluginConfig(config);
  }

  async saveConfiguration() {
    this.#logSystem.info('Saving current configuration');
    this.#interactionSystem.PUTRequest('/mock_server/v1/workspace/object', [
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

  openPanelInModal(panelName, version) {
    if (!this.#modalInstance) {
      const modalBackdrop = document.createElement('div');
      modalBackdrop.classList.add('modal-backdrop');
      modalBackdrop.id = 'modal-backdrop';
      const modal = document.createElement('div');
      modal.classList.add('modal');

      const panelContainer = document.createElement('div');
      panelContainer.id = 'mount-point';
      modal.appendChild(panelContainer);
      modalBackdrop.appendChild(modal);

      modalBackdrop.addEventListener('click', evt => {
        if (evt.target.isEqualNode(modalBackdrop)) {
          this.closeModal();
        }
      });

      modal.addEventListener('click', evt => {
        evt.stopPropagation();
      });

      try {
        const plugin = this.getPlugin(panelName, version);
        document.body.append(modalBackdrop);
        this.#modalInstance = new plugin('', '#mount-point', true);
      } catch (err) {
        this.#logSystem.error(
          `Can't create modal with panel '${panelName} ${version}' due to error: ${err}`
        );
      }
    }
  }

  closeModal() {
    const modal = document.getElementById('modal-backdrop');
    if (modal) {
      modal.remove();
      this.#modalInstance = null;
    }
  }
}
