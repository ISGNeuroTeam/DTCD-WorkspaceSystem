import 'gridstack/dist/gridstack.min.css';
import { GridStack } from 'gridstack';
import 'gridstack/dist/h5/gridstack-dd-native';

import {
  EventSystemAdapter,
  SystemPlugin,
  InteractionSystemAdapter,
  LogSystemAdapter,
  StyleSystemAdapter,
  NotificationSystemAdapter,
} from './../../DTCD-SDK/index';
import { version } from './../package.json';

import './styles/panel.scss';
import './styles/modal.scss';
import gridstackOptions from './utils/gridstackOptions';
import TabsSwitcher from './TabsSwitcher';
import utf8_to_base64 from './libs/utf8tobase64';
import TabsPanelComponent from './TabsPanelComponent';

export class WorkspaceSystem extends SystemPlugin {
  // ---- PLUGIN PROPS ----
  #guid;
  #eventSystem;
  #interactionSystem;
  #logSystem;
  #notificationSystem;
  #tabPanelsConfig;

  // ---- STATE ----
  #panels;
  #panelStyles;
  #wssStyleTag;
  #currentTitle;
  #currentPath;
  #currentID;
  #column;

  // ---- INTERNAL'S ----
  #activeGrid;
  #gridCollection;
  #editMode;
  #modalInstance;
  #tabsSwitcherInstance;
  #styleSystem;

  #tabsCollection = [];
  #vueComponent;

  static getRegistrationMeta() {
    return {
      name: 'WorkspaceSystem',
      type: 'core',
      title: 'Система рабочего стола',
      version,
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
    this.#styleSystem = new StyleSystemAdapter('0.5.0');

    this.#panels = [];
    this.#editMode = false;
    this.#modalInstance = null;
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
    const optionsBorderSizes = [];

    for (let i = 1; i <= 10; i++) {
      optionsBorderSizes.push({
        value: i + 'px',
        label: i + 'px',
      });
    }

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
          component: 'switch',
          propName: 'editMode',
          attrs: {
            label: 'Редактировать рабочий стол',
          },
          handler: {
            event: 'input',
            callback: this.changeMode.bind(this),
          },
        },
        {
          component: 'switch',
          propName: 'visibleTabNavBar',
          attrs: {
            label: 'Скрыть/отобразить вкладки',
          },
          handler: {
            event: 'change',
            callback: this.#handleToggleNavBarChange.bind(this),
          },
        },
        {
          component: 'divider',
        },
        {
          component: 'select',
          propName: 'panelBorderWidth',
          attrs: {
            label: 'Толщина границы панелей',
          },
          handler: {
            event: 'change',
            callback: this.#handleBorderWidthChange.bind(this),
          },
          options: optionsBorderSizes,
        },
        {
          component: 'select',
          propName: 'panelBorderStyle',
          attrs: {
            label: 'Стиль границы панелей',
          },
          handler: {
            event: 'change',
            callback: this.#handleBorderStyleChange.bind(this),
          },
          options: [
            { value: 'solid', label: 'Сплошная (solid)' },
            { value: 'dashed', label: 'Прерывистая (dashed)' },
            { value: 'dotted', label: 'Точечная (dotted)' },
            { value: 'double', label: 'Двойная сплошная (double)' },
            { value: 'groove', label: 'Бордюр (groove)' },
            { value: 'ridge', label: 'Ребро (ridge)' },
            { value: 'inset', label: 'Inset (inset)' },
            { value: 'outset', label: 'Outset (outset)' },
            { value: 'none', label: 'Отключить (none)' },
          ],
        },
        {
          component: 'colorpicker',
          propName: 'panelBorderColor',
          attrs: {
            label: 'Цвет границы панелей',
          },
          handler: {
            event: 'change',
            callback: this.#handleBorderColorChange.bind(this),
          },
        },
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
  }

  mountDashboardContainer(element) {
    if (!this.#notificationSystem) {
      try {
        this.#notificationSystem = new NotificationSystemAdapter('0.1.1');
      } catch (error) {
        this.#logSystem.error('Failed to get NotificationSystem in WorkspaceSystem.');
        console.error(error);
      }
    }

    if (!(element instanceof HTMLElement)) {
      this.#logSystem.debug('The element is not an HTMLElement');
      return false;
    }

    if (!document.body.contains(element)) {
      this.#logSystem.debug('The element is not contained in the DOM');
      return false;
    }

    const { default: VueJS } = this.getDependence('Vue');

    element.innerHTML = '';

    this.#tabsSwitcherInstance = new TabsSwitcher({
      tabsCollection: this.#tabsCollection,
    });

    const data = {
      guid: this.#guid,
      interactionSystem: this.#interactionSystem,
      eventSystem: this.#eventSystem,
      plugin: this,
      tabsCollection: this.#tabsCollection,
      editMode: this.#editMode,
      visibleNavBar: false,
      tabsSwitcherInstance: this.#tabsSwitcherInstance,
    };
    const panel = new VueJS({
      data: () => data,
      render: h => h(TabsPanelComponent),
    }).$mount();
    this.#vueComponent = panel.$children[0];

    this.#tabsSwitcherInstance.htmlElement.appendChild(this.#vueComponent.$el);
    element.appendChild(this.#tabsSwitcherInstance.htmlElement);
    
    this.#tabsSwitcherInstance.htmlElement.addEventListener('tab-active', this.#handleTabsSwitcherActive);
    this.#tabsSwitcherInstance.htmlElement.addEventListener('tab-delete', this.#handleTabsSwitcherDelete);
    this.#tabsSwitcherInstance.htmlElement.addEventListener('tab-add', this.#handleTabsSwitcherAdd);

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
      const config = typeof system.getPluginConfig === 'function' && system !== this ? system.getPluginConfig() : null;

      plugins.push({ guid, meta, config });
    });

    this.#panels
      .filter(panel => panel.instance)
      .forEach(panel => {
        const guid = panel.guid;
        const meta = panel.meta;
        const config = typeof panel.instance.getPluginConfig === 'function' ? panel.instance.getPluginConfig() : null;

        const { h, w, x, y } = panel?.widget.gridstackNode;
        const position = {
          h,
          w,
          x,
          y,
          tabId: panel?.position.tabId,
        };
        const undeletable = panel.undeletable;
        const toFixPanel = panel.toFixPanel;

        plugins.push({ guid, meta, config, position, undeletable, toFixPanel });
      });

    const tabPanelsConfig = this.#vueComponent.getConfig;

    return {
      id: this.#currentID,
      title: this.#currentTitle,
      column: this.#column,
      editMode: this.#editMode,
      plugins,
      tabPanelsConfig,
      visibleTabNavBar: tabPanelsConfig.visibleNavBar,
      panelBorderWidth: this.#panelStyles['border-width'] || '',
      panelBorderStyle: this.#panelStyles['border-style'] || '',
      panelBorderColor: this.#panelStyles['border-color'] || '',
    };
  }

  async setPluginConfig(config = {}) {
    this.resetWorkspace();
    this.#logSystem.info(`Setting workspace configuration (id:${config?.id}, title:${config?.title})`);

    // Tabs panels
    let activeTabId = this.#getTabIdUrlParam();
    config.tabPanelsConfig instanceof Object
      ? (this.#tabPanelsConfig = config.tabPanelsConfig)
      : (this.#tabPanelsConfig = null);
    this.#createTabsSwitcher();

    // remember id of active tab panel if tab id dont exist in url
    if (!activeTabId) {
      this.#gridCollection.forEach((gridData, key) => {
        if (gridData.isActive) {
          activeTabId = key;
          return;
        }
      });
    }

    // ---- COLUMN ----
    if (typeof config.column != 'undefined') this.setColumn(config.column);

    this.#currentTitle = config.title;
    this.#currentID = config.id;
    this.#currentPath = config.path;

    // ---- PLUGINS ----

    let eventSystemConfig = {};

    // ---- installing-plugins-from-config ----
    const GUIDMap = {};
    pluginsLoop: for (let plugin of config.plugins) {
      let { meta, config, position = {}, guid, toFixPanel } = plugin;
      switch (meta?.type) {
        case 'panel':
          let widget;
          if (typeof meta.name !== 'undefined') {
            const pluginExists = this.getPlugin(meta.name, meta.version);
            if (pluginExists) {
              this.#logSystem.debug('Creating empty cell');

              // активирование таба нужно для корректной отрисовки визуализаций
              if (position?.tabId && !position.isActive) {
                this.#vueComponent.setActiveTab(position.tabId);
              }

              widget = this.createCell({
                name: meta.name,
                version: meta.version,
                guid,
                ...position,
                autoPosition: false,
                toFixPanel,
              });
            }
            const plugin = this.#panels.find(panel => panel.widget === widget).instance;
            const pluginGUID = this.getGUID(plugin);
            this.#logSystem.debug(`Mapping guid of ${meta.name} from ${guid} to ${pluginGUID}`);
            GUIDMap[guid] = pluginGUID;
          } else {
            const { w, h, x, y, tabId } = position;
            this.createEmptyCell(w, h, x, y, tabId, false);
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
      if (instance && instance !== this && instance.setPluginConfig && config) await instance.setPluginConfig(config);
    }

    // активируем таб, который должен быть активным после открытия рабочего стола.
    this.#vueComponent.setActiveTab(activeTabId);

    // EVENT-SYSTEM-MAPPING
    if (eventSystemConfig.hasOwnProperty('subscriptions')) {
      for (let sub of eventSystemConfig.subscriptions) {
        const { event, action } = sub;
        event.guid = GUIDMap[event.guid];
        action.guid = GUIDMap[action.guid];
      }
    }

    this.#panels.forEach((panel) => {
      if (panel.toFixPanel) this.#createGridCellClones(panel.guid);
    });

    // settings panel styles
    this.#panelStyles = {
      'border-width': config.panelBorderWidth || '2px',
      'border-style': config.panelBorderStyle || 'solid',
      'border-color': config.panelBorderColor || 'var(--background_secondary)',
    };
    this.#setPanelStyles();

    await this.#eventSystem.setPluginConfig(eventSystemConfig);
    return true;
  }

  async downloadConfiguration(downloadPath) {
    const delimIndex = downloadPath.search(/:id=/);
    const id = delimIndex !== -1 ? downloadPath.slice(delimIndex + 4) : downloadPath;
    const path = delimIndex !== -1 ? downloadPath.slice(0, delimIndex) : '';

    this.#logSystem.debug(`Trying to download configuration with id:${id}`);
    const { data } = await this.#interactionSystem.GETRequest(`/dtcd_workspaces/v1/workspace/object/${path}?id=${id}`);
    this.#logSystem.debug(`Parsing configuration from response`);
    const content = data.content;
    content['id'] = data.id;
    content['title'] = data.title;
    content['path'] = path;
    return content;
  }

  resetWorkspace() {
    this.#logSystem.debug('Resetting current workspace configuration');
    this.#panels.forEach(plugin => {
      const { meta, widget, instance } = plugin;
      if (meta?.type !== 'core') {
        if (widget) {
          for (const gridData of this.#gridCollection) {
            gridData[1].gridInstance.removeWidget(widget);
          }
        }
        if (instance) this.uninstallPluginByInstance(instance);
      }
    });
    this.#panels = [];
    this.#editMode = false;
    this.#panelStyles = {};
    this.#logSystem.debug(`Clearing panels array`);
    // this.setColumn();
  }

  resetSystem() {
    this.resetWorkspace();
  }

  async deleteConfiguration(id) {
    try {
      this.#logSystem.debug(`Trying to delete workspace configuration with id:${id}`);
      await this.#interactionSystem.DELETERequest('/dtcd_workspaces/v1/workspace/object/', {
        data: [id],
      });
      this.#logSystem.info(`Deleted workspace configuration with id:${id}`);
    } catch (err) {
      this.#logSystem.error(`Error occured while deleting workspace configuration: ${err.message}`);
    }
  }

  async createEmptyConfiguration(params = {}) {
    const { title, description, color, icon, isFolder, path } = params;

    this.#logSystem.debug(`Trying to create new empty configuration with title:'${title}`);
    const content = {
      column: 12,
      plugins: [],
    };
    content.title = title;

    const meta = isFolder ? { description } : { description, color, icon };
    const data = isFolder ? { title, dir: null, meta } : { title, content, meta };

    const endpoint = '/dtcd_workspaces/v1/workspace/object/';

    try {
      this.#logSystem.debug(`Sending request to create configurations`);
      await this.#interactionSystem.POSTRequest(endpoint + utf8_to_base64(path), [data]);
      this.#logSystem.info(`Successfully created new configuration with title:'${title}'`);
    } catch (err) {
      this.#logSystem.error(`Error occured while downloading workspace configuration: ${err.message}`);
    }
  }

  async importConfiguration(configuration) {
    this.#logSystem.debug(`Trying to import configuration with title:'${configuration.title}`);
    try {
      this.#logSystem.debug(`Sending request to import configurations`);
      await this.#interactionSystem.POSTRequest('/dtcd_workspaces/v1/workspace/object/', [
        {
          title: configuration.title,
          content: configuration,
        },
      ]);
      this.#logSystem.info(`Successfully imported configuration with title:'${configuration.title}'`);
    } catch (err) {
      this.#logSystem.error(`Error occured while importing workspace configuration: ${err.message}`);
    }
  }

  async changeConfigurationTitle(id, title) {
    this.#logSystem.debug(`Trying to change configuration title with id:${id} to value:'${title}'`);
    try {
      await this.#interactionSystem.PUTRequest('/dtcd_workspaces/v1/workspace/object/', [
        {
          id,
          title,
        },
      ]);

      this.#logSystem.info(`New title:'${title}' was set to configuration with id:${id}`);
    } catch (err) {
      this.#logSystem.error(`Error occured while downloading workspace configuration: ${err.message}`);
    }
  }

  #getPanelId(panelName) {
    const panelInstances = this.#panels.filter(panel => panel.guid.includes(panelName));
    const ids = panelInstances.map(panel => {
      return parseInt(panel.guid.split('_').pop());
    });

    const maxID = Math.max(...ids);
    return maxID !== -Infinity ? maxID + 1 : 1;
  }

  createCell({ name, version, guid = null, w = 6, h = 8, x = 0, y = 0, tabId, autoPosition = true, toFixPanel }) {
    this.#logSystem.debug(
      `Adding panel-plugin widget with name:'${name}', version:${version}, w:${w},h:${h},x:${x},y:${y}, autoPosition:${autoPosition}`
    );
    this.#logSystem.info(`Adding panel widget with name: '${name}', version: '${version}'`);

    if (!guid) {
      const panelID = this.#getPanelId(name);
      guid = `${name}_${panelID}`;
    }

    toFixPanel = Boolean(toFixPanel);

    let targetGrid = this.#gridCollection.get(tabId)?.gridInstance;
    targetGrid = targetGrid ? targetGrid : this.#activeGrid;

    const widget = this.#createWidget(
      targetGrid,
      { x, y, w, h, autoPosition, guid, toFixPanel }
    );

    const panelInstance = this.installPanel({
      name,
      guid,
      version,
      selector: `#panel-${guid}`,
    });

    const meta = panelInstance.constructor.getRegistrationMeta();

    this.#panels.push({
      widget,
      position: {
        tabId: this.#getGridIdByObject(targetGrid),
      },
      instance: panelInstance,
      guid,
      meta,
      toFixPanel,
    });

    // отключил этот код, так как при инициализации рабочего стола
    // панели в сетках устанавливаются не так, как их сохранили.
    // if (toFixPanel) {
    //   this.#createGridCellClones(guid);
    // }

    return widget;
  }

  deleteCell(guid) {
    this.#logSystem.debug(`Trying to delete cell from workspace with guid: ${guid}`);
    const panel = this.#panels.find(panel => panel.guid === guid);
    if (!panel) {
      this.#logSystem.debug(`No cell element found on workspace with given guid: ${guid}`);
      return;
    }

    if (panel.toFixPanel) this.#deleteGridCellClones(panel.guid);
    const targetGrid = this.#gridCollection.get(panel.position.tabId).gridInstance;
    targetGrid.removeWidget(panel.widget);

    this.uninstallPluginByGUID(guid);

    this.#panels.splice(
      this.#panels.findIndex(plg => plg.guid === guid),
      1
    );

    this.#logSystem.info(`Deleted cell from workspace with guid: ${guid}`);
  }

  toggleFixPanel(guid) {
    this.#logSystem.debug(`Start toggle fixation of cell on workspace with guid: ${guid}`);

    const panel = this.#panels.find(panel => panel.guid === guid);
    if (!panel) {
      this.#logSystem.debug(`No cell element found on workspace with given guid: ${guid}`);
      return;
    }

    panel.toFixPanel = !Boolean(panel.toFixPanel);
    const targetGrid = this.#gridCollection.get(panel.position.tabId).gridInstance;
    targetGrid.update(
      panel.widget,
      {
        noMove: panel.toFixPanel,
        noResize: panel.toFixPanel,
        locked: panel.toFixPanel,
      }
    );
    
    if (panel.toFixPanel) this.#createGridCellClones(guid);
    else this.#deleteGridCellClones(guid);

    this.#logSystem.info(`End toggle fixation of cell on workspace with guid: ${guid}`);
  }

  compactAllPanels() {
    this.#logSystem.info(`Compacting cells on workspace`);
    for (const gridData of this.#gridCollection) {
      gridData[1].gridInstance.compact();
    }
  }

  changeMode() {
    this.#editMode = !this.#editMode;

    const panelBorder = document.querySelectorAll('.grid-stack-item');
    panelBorder.forEach((gridCell) => {
      if (this.#editMode) gridCell.classList.add('grid-stack-item_editing');
      else gridCell.classList.remove('grid-stack-item_editing');
    });

    const margin = this.#editMode ? '2px' : '0px';
    for (const gridData of this.#gridCollection) {
      gridData[1].gridInstance.batchUpdate();
      gridData[1].gridInstance.margin(margin);
      gridData[1].gridInstance.commit();
      gridData[1].gridInstance.setStatic(!this.#editMode);
    }

    if (this.#vueComponent) {
      this.#vueComponent.editMode = this.#editMode;
    }

    this.#logSystem.info(`Workspace edit mode turned ${this.#editMode ? 'on' : 'off'}`);
  }

  async getConfigurationList() {
    const response = await this.#interactionSystem.GETRequest('/dtcd_workspaces/v1/workspace/object/');
    return response.data;
  }

  async setConfiguration(id) {
    try {
      const config = await this.downloadConfiguration(id);
      return this.setPluginConfig(config);
    } catch (err) {
      console.error(err);
      this.#logSystem.error(`Error occured while downloading workspace configuration: ${err.message}`);
      const errorMsg = 'Произошла ошибка в процессе загрузки и установки данных рабочего стола.';
      this.#notificationSystem && this.#notificationSystem.create(
        'Ошибка на рабочем столе.',
        errorMsg,
        {
          floatMode: true,
          floatTime: 5,
          type: 'error',
        }
      );
      this.getSystem('AppGUISystem', '0.1.0').goTo404();
    }
  }

  async saveConfiguration() {
    this.#logSystem.info('Saving current configuration');

    try {
      await this.#interactionSystem.PUTRequest(`/dtcd_workspaces/v1/workspace/object/${this.#currentPath}`, [
        {
          id: this.#currentID,
          title: this.#currentTitle,
          content: this.getPluginConfig(),
        },
      ]);
  
      this.#notificationSystem && this.#notificationSystem.create(
        'Готово!',
        'Настройки рабочего стола сохранены.',
        {
          floatMode: true,
          floatTime: 5,
          type: 'success',
        }
      );
    } catch (error) {
      this.#notificationSystem && this.#notificationSystem.create(
        'Ошибка на рабочем столе.',
        'Произошла ошибка в процессе сохранения данных рабочего стола.',
        {
          floatMode: true,
          floatTime: 5,
          type: 'error',
        }
      );
      throw error;
    }
  }

  setColumn(newColumn) {
    const column = typeof newColumn !== 'undefined' ? newColumn : 12;
    const head = document.head || document.getElementsByTagName('head')[0];

    let styleEl = head.querySelector('style#gridstack-custom-style');
    if (styleEl) head.removeChild(styleEl);

    for (const gridData of this.#gridCollection) {
      gridData[1].gridInstance.column(column);
      gridData[1].gridInstance.el.querySelectorAll('.grid-stack-item').forEach(itemEl => {
        itemEl.style.minWidth = `${100 / column}%`;
      });
    }

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
        this.#styleSystem.setVariablesToElement(modalBackdrop, this.#styleSystem.getCurrentTheme());
      } catch (err) {
        this.#logSystem.error(`Can't create modal with panel '${panelName} ${version}' due to error: ${err}`);
        const errorMsg = `Не удалось создать модальное окно с панелью '${panelName} (${version})'. Ошибка: ${err}`;
        this.#notificationSystem && this.#notificationSystem.create(
          'Ошибка на рабочем столе.',
          errorMsg,
          {
            floatMode: true,
            floatTime: 5,
            type: 'error',
          }
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

  #createTabsSwitcher() {
    this.#gridCollection = new Map();
    this.#tabsCollection = [];

    if (this.#tabPanelsConfig instanceof Object) {
      for (let i = 0; i < this.#tabPanelsConfig.tabsOptions.length; i++) {
        const tabOptions = this.#tabPanelsConfig.tabsOptions[i];
        const tabId = this.#vueComponent.addNewTab(tabOptions);

        if (tabOptions.isActive) {
          this.#vueComponent.setActiveTab(tabId);
        }
      }
      this.#vueComponent.visibleNavBar = this.#tabPanelsConfig.visibleNavBar;
    } else {
      const tabId = this.#vueComponent.addNewTab({id: this.#getTabIdUrlParam()});
      this.#vueComponent.setActiveTab(tabId);
      this.#vueComponent.visibleNavBar = false;
    }
  }

  #handleTabsSwitcherAdd = event => {
    const tabId = event.detail?.tabId;

    if (!tabId) return;

    const gridStackEl = document.createElement('div');
    gridStackEl.className = 'grid-stack';
    this.#vueComponent.getTab(tabId).tabPanel.appendChild(gridStackEl);

    const gridstackChangedOpts = this.#editMode
                                  ? {...gridstackOptions, staticGrid: false}
                                  : gridstackOptions;
    const newGrid = GridStack.init(gridstackChangedOpts, gridStackEl);

    this.#gridCollection.set(tabId, {
      isActive: false,
      gridInstance: newGrid,
    });

    this.#panels.forEach((panel) => {
      if (panel.toFixPanel) this.#createGridCellClones(panel.guid);
    });
  };

  #handleTabsSwitcherActive = (event) => {
    if (!this.#gridCollection) return;

    const activeTabId = event.detail.tabId;
    if (!activeTabId) return;

    for (const gridItem of this.#gridCollection) {
      if (gridItem[0] === activeTabId) {
        gridItem[1].isActive = true;
        this.#activeGrid = gridItem[1].gridInstance;
      } else {
        gridItem[1].isActive = false;
      }
    }

    this.#setTabIdUrlParam(activeTabId);

    this.#panels.forEach((panel) => {
      if (panel.toFixPanel) {
        this.#changeFixedPanelPosition(panel);
      }
      if (typeof panel.instance.setVisible === 'function') {
        panel.instance.setVisible(activeTabId === panel?.position.tabId)
      }
    })
  };

  #setTabIdUrlParam(tabId) {
    if (!tabId) return;

    const urlSearchParams = new URLSearchParams(window.location.search);
    urlSearchParams.set('ws-tab-id', tabId);

    Application.getSystem('RouteSystem', '0.3.0').navigate(
      `${window.location.pathname}?${urlSearchParams.toString()}`,
      true,
      {workspaceID: this.currentWorkspaceID},
    )
  }

  #getTabIdUrlParam() {
    const urlSearchParams = new URLSearchParams(window.location.search);
    return urlSearchParams.get('ws-tab-id');
  }

  #handleTabsSwitcherDelete = (event) => {
    if (!this.#gridCollection) return;

    const deletingTabId = event.detail.tabId;
    this.#logSystem.debug(`Deleting workspace tab panel with id '${deletingTabId}'.`);

    const deletingGrid = this.#gridCollection.get(deletingTabId)?.gridInstance;
    if (!deletingGrid) {
      this.#logSystem.debug(`Deleting workspace tab panel with id '${deletingTabId}' not found.`);
      return;
    }

    this.#panels = this.#panels.filter(plugin => {
      const { widget, guid, position } = plugin;
      if (position.tabId === deletingTabId) {
        if (widget) {
          this.#deleteGridCellClones(guid);
          deletingGrid.removeWidget(widget);
        }
        this.uninstallPluginByGUID(guid);
        return false;
      } else {
        return true;
      }
    });

    // если удаляемый таб был активным и не единственным...
    const isDeletedTabActive = this.#gridCollection.get(deletingTabId).isActive;
    const isLastTab = this.#gridCollection.size === 1;
    const resultCondition = isDeletedTabActive && !isLastTab;
    if (resultCondition) {
      // ...то находим следующий таб и активируем его.
      let nextTabPanelId;
      this.#gridCollection.forEach((value, key, map) => {
        if (key === deletingTabId) return;
        else nextTabPanelId = key;
      });

      this.#gridCollection.delete(deletingTabId);
      this.#vueComponent.setActiveTab(nextTabPanelId);
    } else {
      // ...иначе просто удаляем сетку.
      this.#gridCollection.delete(deletingTabId);
    }
  };

  #getGridIdByObject(desiredGrid) {
    for (const gridData of this.#gridCollection) {
      if (gridData[1].gridInstance === desiredGrid) return gridData[0];
    }
    return null;
  }

  #handleToggleNavBarChange = event => {
    if (this.#vueComponent) {
      this.#vueComponent.visibleNavBar = event.currentTarget.checked;
    }
  };

  #handleBorderWidthChange = event => {
    const size = event.target.value;
    this.#panelStyles['border-width'] = size;
    this.#setPanelStyles();
  };

  #handleBorderStyleChange = event => {
    const style = event.target.value;
    this.#panelStyles['border-style'] = style;
    this.#setPanelStyles();
  };

  #handleBorderColorChange = event => {
    const color = event.target.value;
    this.#panelStyles['border-color'] = color;
    this.#setPanelStyles();
  };

  #setPanelStyles() {
    if (!this.#wssStyleTag) {
      this.#wssStyleTag = document.createElement('style');
      this.#wssStyleTag.id = 'panel-border-styles';
    }

    const htmlTabsSwitcher = this.#tabsSwitcherInstance.htmlElement;
    if (!htmlTabsSwitcher.querySelector('#panel-border-styles')) {
      htmlTabsSwitcher.appendChild(this.#wssStyleTag);
    }

    let borderStyles = '.grid-stack-item-content{';
    if (this.#panelStyles['border-width']) {
      borderStyles += `border-width: ${this.#panelStyles['border-width']};`;
    }
    if (this.#panelStyles['border-style']) {
      borderStyles += `border-style: ${this.#panelStyles['border-style']};`;
    }
    if (this.#panelStyles['border-color']) {
      borderStyles += `border-color: ${this.#panelStyles['border-color']};`;
    }
    borderStyles += '}';

    this.#wssStyleTag.textContent = borderStyles;
  }

  #createGridCellClones(guid) {
    this.#logSystem.debug(`Start of creation grid cell clones for panel ${guid}.`);

    const panel = this.#panels.find(panel => panel.guid === guid);
    if (!panel) {
      this.#logSystem.debug(`No cell element found on workspace with given guid: ${guid}`);
      return;
    }
    const tabId = panel.position.tabId;
    const { h, w, x, y } = panel?.widget.gridstackNode;

    this.#gridCollection.forEach((gridData, key) => {
      if (key === tabId) return;

      let isExistGridCell = false;
      gridData.gridInstance.getGridItems().forEach((gridCell) => {
        // find doubles grid items
        if (gridCell.getAttribute('gs-id') === guid) {
          isExistGridCell = true;
          return;
        }
      });

      if (!isExistGridCell) {
        this.#createWidget(
          gridData.gridInstance,
          { x, y, w, h, autoPosition: false, guid, toFixPanel: true, empty: true, }
        );
      }
    });

    this.#logSystem.info(`End of creation grid cell clones for panel ${guid}.`);
  }

  #deleteGridCellClones(guid) {
    this.#logSystem.debug(`Start of deleting grid cell clones for panel ${guid}.`);

    const panel = this.#panels.find(panel => panel.guid === guid);
    if (!panel) {
      this.#logSystem.debug(`No cell element found on workspace with given guid: ${guid}`);
      return;
    }

    this.#gridCollection.forEach((gridData, key) => {
      gridData.gridInstance.getGridItems().forEach((gridCell) => {
        if (gridCell.getAttribute('gs-id') === guid) {
          if (gridCell.hasAttribute('data-empty-item')) {
            gridData.gridInstance.removeWidget(gridCell);
            return;
          }
        }
      });
    });

    this.#logSystem.info(`End of deleting grid cell clones for panel ${guid}.`);
  }

  #createWidget(targetGrid, gridItemOptions) {
    this.#logSystem.debug(`Start of creation grid item cell.`);

    const {
      guid = null,
      id = guid,
      w = 6,
      h = 8,
      x = 0,
      y = 0,
      autoPosition = true,
      toFixPanel,
      empty,
    } = gridItemOptions;

    const widget = targetGrid.addWidget(
      `
      <div
        class="grid-stack-item${this.#editMode ? ' grid-stack-item_editing' : ''}"
        ${empty ? ' data-empty-item' : ''}
      >
        <div class="grid-stack-item-content">
          <div class="handle-drag-of-panel gridstack-panel-header">
            <button
              class="fix-panel-button"
              type="button"
              title="Зафиксировать панель"
            >
              <span class="FontIcon name_location size_lg"></span>
            </button>
            <button
              class="close-panel-button"
              type="button"
              title="Удалить панель"
            >
              <span class="FontIcon name_closeBig size_lg"></span>
            </button>
            <button
              class="drag-panel-button"
              type="button"
              title="Переместить панель"
            >
              <span class="FontIcon name_move size_lg"></span>
            </button>
          </div>
          <div class="gridstack-content-container">
            ${empty ? '' : `<div id="panel-${guid}"></div>`}
          </div>
        </div>
      </div>
      `,
      {
        x, y, w, h, autoPosition, id,
        locked: toFixPanel, noMove: toFixPanel, noResize: toFixPanel,
      }
    );

    widget.addEventListener('click', () => {
      if (!this.#editMode) this.#eventSystem.publishEvent('WorkspaceCellClicked', { guid });
    });

    widget.querySelector('.close-panel-button')
          .addEventListener('click', this.deleteCell.bind(this, guid));
    widget.querySelector('.fix-panel-button')
          .addEventListener('click', this.toggleFixPanel.bind(this, guid));

    this.#logSystem.info(`End of creation grid item cell.`);
    return widget;
  }

  #changeFixedPanelPosition(panel) {
    this.#logSystem.debug(`Start to replace fixed panel (guid: ${panel.guid}).`);
    
    const htmlOfPanelInstance = panel.widget.querySelector('.gridstack-content-container > *');
    if (!htmlOfPanelInstance || !htmlOfPanelInstance instanceof HTMLElement) {
      this.#logSystem.debug('HTML element of panel not found.');
      return;
    }

    panel.widget.setAttribute('data-empty-item', '');

    this.#activeGrid.getGridItems().forEach((gridCell) => {
      if (gridCell.getAttribute('gs-id') === panel.guid) {
        gridCell.querySelector('.gridstack-content-container').append(htmlOfPanelInstance);
        gridCell.removeAttribute('data-empty-item');
        panel.position.tabId = this.#getGridIdByObject(this.#activeGrid);
        panel.widget = gridCell;
        return;
      }
    });

    this.#logSystem.info(`End to replace fixed panel (guid: ${panel.guid}).`);
  }
}
