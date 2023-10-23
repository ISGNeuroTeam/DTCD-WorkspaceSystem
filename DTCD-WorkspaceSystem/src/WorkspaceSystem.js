import { GridStack } from 'gridstack';

import './styles/panel.scss';
import './styles/modal.scss';
import 'gridstack/dist/gridstack.min.css';
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
import utf8_to_base64 from './libs/utf8tobase64';
import gridstackOptions from './utils/gridstackOptions';
import createWidgetErrorMessage from './utils/createWidgetErrorMessage';
import TabsSwitcher from './TabsSwitcher';
import TabsPanelComponent from './TabsPanelComponent';
import gridStackItemHtml from './templates/gridStackItem.html';

const replaces = {
  LiveDashPanel_SimpleMath: 'LiveDashPanel',
  PrimitivePropertiesPanel_SimpleMath: 'PrimitivePropertiesPanel',
};

export class WorkspaceSystem extends SystemPlugin {
  // ---- PLUGIN PROPS ----
  #guid;
  #eventSystem;
  #interactionSystem;
  #logSystem;
  #router;
  #notificationSystem;
  #tabPanelsConfig;

  // ---- STATE ----
  #panels = [];
  #widgets = [];
  #panelStyles;
  #wssStyleTag;
  #currentTitle;
  #currentPath;
  #currentID;
  #column;
  #typeInit;
  #hiddenPanelPlugins = [];

  // ---- INTERNAL'S ----
  #activeGrid;
  #gridCollection;
  #editMode = false;
  #modalInstance = null;
  #tabsSwitcherInstance;
  #styleSystem;

  #tabsCollection = [];
  #vueComponent;
  #workspaceContainer;

  #GUIDMap = {};
  #existedPlugins = {};
  #replacedPlugins = {};
  #notFoundPlugins = [];

  static getRegistrationMeta() {
    return {
      name: 'WorkspaceSystem',
      type: 'core',
      title: 'Система рабочего стола',
      version,
      priority: 2,
    };
  }

  static INIT_TYPES = ['TYPE-1', 'TYPE-2'];

  constructor(guid) {
    super();
    this.#guid = guid;
    this.#eventSystem = new EventSystemAdapter('0.4.0', guid);
    this.#eventSystem.registerPluginInstance(this, [
      'WorkspaceCellClicked',
      'WorkspaceTabSelectedProgrammly',
      'WorkspaceTabClicked',
      'WorkspaceTitleLoaded',
      'WorkspaceEditModeChanged',
    ]);
    this.#interactionSystem = new InteractionSystemAdapter('0.4.0');
    this.#logSystem = new LogSystemAdapter('0.5.0', this.#guid, 'WorkspaceSystem');
    this.#styleSystem = new StyleSystemAdapter('0.5.0');

    this.#typeInit = WorkspaceSystem.INIT_TYPES[0];
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

  get tabsCollection() {
    return this.#tabsSwitcherInstance?.tabsCollection;
  }

  get typeInit() {
    return this.#typeInit;
  }

  set typeInit(newValue) {
    this.#typeInit = WorkspaceSystem.INIT_TYPES.includes(newValue) ? newValue : WorkspaceSystem.INIT_TYPES[0];
  }

  getFormSettings() {
    const optionsBorderSizes = [];

    for (let i = 1; i <= 10; i++) {
      optionsBorderSizes.push({
        value: i + 'px',
        label: i + 'px',
      });
    }

    const editModeSwitchAttrs = {
      label: 'Редактировать рабочий стол',
    };
    if (this.#editMode) editModeSwitchAttrs.checked = true;

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
          attrs: editModeSwitchAttrs,
          handler: {
            event: 'input',
            callback: (event) => {
              this.changeMode(event.target.checked);
            },
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
        {
          component: 'divider',
        },
        {
          component: 'select',
          propName: 'typeInit',
          attrs: {
            label: 'Варианты открытия рабочего стола',
          },
          handler: {
            event: 'change',
            callback: this.#handleTypeInitChange.bind(this),
          },
          options: [
            { value: 'TYPE-1', label: 'Открываются сразу все вкладки' },
            { value: 'TYPE-2', label: 'Открывается только активная' },
          ],
        },
      ],
    };
  }

  setFormSettings(config) {
    const { title, column } = config;
    this.#currentTitle = title;
    this.setColumn(column);
    // this.saveConfiguration();
  }

  async init() {
    return;
  }

  mountDashboardContainer(element) {
    if (!this.#router) this.#router = Application.getSystem('RouteSystem', '0.4.0');
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

    this.#workspaceContainer = element;
    
    this.#eventSystem.subscribe({
      eventGUID: this.#guid,
      eventName: 'WorkspaceTitleLoaded',
      actionGUID: 'HeaderPanel_top',
      actionName: 'showTitle',
      subsctiptionType: 'system',
    });

    const workspaceID = history.state.workspaceID;
    this.setConfiguration(workspaceID).then(() => {
      this.recoveryPluginStateFromUrl();
    });

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

    // панели, которые не были созданы
    this.#hiddenPanelPlugins.forEach(panel => {
      if (panel) plugins.push(panel);
    });

    const tabPanelsConfig = this.#vueComponent.getConfig;

    return {
      id: this.#currentID,
      title: this.#currentTitle,
      column: this.#column,
      editMode: this.#editMode,
      typeInit: this.typeInit,
      plugins,
      tabPanelsConfig,
      visibleTabNavBar: tabPanelsConfig.visibleNavBar,
      panelBorderWidth: this.#panelStyles['border-width'] || '',
      panelBorderStyle: this.#panelStyles['border-style'] || '',
      panelBorderColor: this.#panelStyles['border-color'] || '',
    };
  }

  async setPluginConfig(config = {}) {
    this.#logSystem.info(`Setting workspace configuration (id: ${config?.id}, title: ${config?.title})`);

    this.resetWorkspace();

    let activeTabId = this.#getTabIdUrlParam();
    this.#tabPanelsConfig = config.tabPanelsConfig instanceof Object ? config.tabPanelsConfig : null;
    this.#createTabsSwitcher();

    if (!config.tabPanelsConfig?.tabsOptions?.some(tab => tab.id === activeTabId)) {
      activeTabId = null;
    }

    // remember id of active tab panel if tab id dont exist in url
    if (!activeTabId) {
      this.#gridCollection.forEach((gridData, key) => {
        if (gridData.isActive) {
          activeTabId = key;
          return;
        }
      });
    }

    if (typeof config.column !== 'undefined') this.setColumn(config.column);

    this.#currentTitle = config.title;
    this.#currentID = config.id;
    this.#currentPath = config.path;
    this.typeInit = config.typeInit;

    this.#eventSystem.publishEvent('WorkspaceTitleLoaded', this.#currentTitle);

    this.#GUIDMap = {};
    this.#existedPlugins = {};
    this.#replacedPlugins = {};
    this.#notFoundPlugins = [];

    let eventSystemConfig = {};

    const panelPlugins = [];

    const calcPanelIDs = name => {
      const panels = config.plugins.filter(p => p.meta.name === name);
      return panels.map(p => p.guid.split('_').pop());
    };

    for (const plugin of config.plugins) {
      const {
        meta = {},
        config = {},
        position = {},
        toFixPanel,
      } = plugin;

      let guid = plugin.guid;

      if (meta?.type === 'core') {
        if (meta.name === 'EventSystem') {
          eventSystemConfig = config;
          continue;
        }

        const instance = this.getSystem(meta.name, meta.version);
        const systemGUID = this.getGUID(instance);
        this.#GUIDMap[guid] = systemGUID;

        if (instance && instance !== this && instance.setPluginConfig && config) {
          instance.setPluginConfig(config);
        }

        continue;
      }

      let originalVersion = meta.version;
      this.#GUIDMap[guid] = guid;

      if (meta?.type === 'panel') {
        if (['LiveDashPanel_SimpleMath', 'PrimitivePropertiesPanel_SimpleMath'].includes(meta.name)) {
          const panelIDs = calcPanelIDs(replaces[meta.name]);

          let maxID = Math.max(...panelIDs);
          maxID = maxID !== -Infinity ? maxID + 1 : 1;

          switch(meta.name) {
            case('LiveDashPanel_SimpleMath'):
              meta.name = 'LiveDashPanel';
              meta.version = '0.17.1';
              originalVersion = '0.17.1';
              config.graphCalcMode = 'sm';
              break;
            case('PrimitivePropertiesPanel_SimpleMath'):
              meta.name = 'PrimitivePropertiesPanel';
              meta.version = '0.10.3';
              originalVersion = '0.10.3';
              config.graphCalcMode = 'sm';
              break;
          }

          const replacedGUID = `${meta.name}_${maxID}`;

          this.#replacedPlugins[replacedGUID] = guid;
          this.#GUIDMap[guid] = replacedGUID;
          plugin.guid = replacedGUID;
          guid = replacedGUID;
        }

        if (this.typeInit === 'TYPE-2') {
          const isPanelOnActiveTab = position?.tabId === activeTabId;
          if (!toFixPanel && !isPanelOnActiveTab) {
            this.#hiddenPanelPlugins.push(plugin);
            continue;
          }
        }

        const widget = this.#createWidget(null, {
          ...position,
          guid,
          toFixPanel,
          autoPosition: false,
        });

        const id = `${meta.name}_${originalVersion}`;

        panelPlugins.push({
          ...meta,
          id,
          guid,
          config,
          widget,
          toFixPanel,
          version: originalVersion,
          tabIdOrGrid: position.tabId,
        });

        try {
          if (this.#existedPlugins.hasOwnProperty(id) || this.#notFoundPlugins.includes(id)) continue;

          const pluginClass = this.getPlugin(meta.name, originalVersion, 3);
          const { version } = pluginClass?.getRegistrationMeta();

          this.#existedPlugins[id] = { version, originalVersion, pluginClass };
        } catch (error) {
          this.#notFoundPlugins.push(id);
          console.error(error);
          this.#notificationSystem.create(
            'Отсутствует плагин',
            `Плагин не найден: ${meta.name} ${meta.version}`,
            { floatMode: true, floatTime: 5, type: 'warning' },
          );
        }
      }
    }

    this.#createPanelPluginsInstances(panelPlugins);

    const checkOriginalVersion = Object.values(this.#existedPlugins).some(p => {
      return p.originalVersion !== p.version;
    });

    if (this.#notFoundPlugins.length > 0 || checkOriginalVersion) {
      this.#notificationSystem.create(
        'Версии плагинов изменены',
        `Версии некоторых плагинов не найдены или были изменены на альтернативные. Проверьте работоспособность рабочего стола.`,
        { floatMode: true, floatTime: 5, type: 'warning' },
      );
    }

    // активируем таб, который должен быть активным после открытия рабочего стола.
    this.#vueComponent.setActiveTab(activeTabId);

    this.#hideTabsPanel();

    // EVENT-SYSTEM-MAPPING
    if (eventSystemConfig.hasOwnProperty('subscriptions')) {
      for (const sub of eventSystemConfig.subscriptions) {
        const { event, action } = sub;
        event.guid = this.#GUIDMap[event.guid];
        action.guid = this.#GUIDMap[action.guid];
      }
    }

    const replacedGUIDS = Object.keys(this.#replacedPlugins);

    if (replacedGUIDS.length > 0 && eventSystemConfig.hasOwnProperty('actions')) {
      for (const action of eventSystemConfig.actions) {
        for (const guid of replacedGUIDS) {
          const originalGuid = this.#replacedPlugins[guid];
          action.callback = action.callback.replaceAll(originalGuid, guid);
        }
      }
    }

    this.#eventSystem.setPluginConfig(eventSystemConfig);

    this.#panels.forEach(panel => {
      if (panel.toFixPanel) this.#createGridCellClones(panel.guid);
    });

    this.#panelStyles = {
      'border-width': config.panelBorderWidth || '2px',
      'border-style': config.panelBorderStyle || 'solid',
      'border-color': config.panelBorderColor || 'var(--background_secondary)',
    };

    this.#setPanelStyles();

    return true;
  }

  #createPanelPluginsInstances(panelPlugins) {
    for (const panel of panelPlugins) {
      const { id, name, version, guid, config, widget } = panel;

      const widgetBody = widget.querySelector(`#panel-${guid}`);

      if (this.#notFoundPlugins.includes(id)) {
        createWidgetErrorMessage(widgetBody, name, version);
        continue;
      }

      const plugin = this.#existedPlugins[id];

      const { originalVersion, version: curVersion } = plugin;
      const isOriginalVersion = curVersion === originalVersion;

      const createPanelAndConfigure = () => {
        this.#createPanel({ ...panel, version: curVersion });

        const instance = !this.#replacedPlugins[guid]
          ? this.getInstance(this.#GUIDMap[guid])
          : this.getInstance(this.#GUIDMap[this.#replacedPlugins[guid]]);

        if (instance && instance.setPluginConfig && config) {
          instance.setPluginConfig(config);
        }
      };

      if (isOriginalVersion) {
        createPanelAndConfigure();
        continue;
      }

      const msg = `Не удалось найти плагин ${name} v${version}. Использовать версию ${curVersion} как альтернативную?`;

      if (plugin.hasOwnProperty('isConfirmVersion')) {
        if (plugin.isConfirmVersion) {
          createPanelAndConfigure();
        } else {
          createWidgetErrorMessage(widgetBody, name, version);
        }
      } else {
        if (confirm(msg)) {
          createPanelAndConfigure();
          plugin.isConfirmVersion = true;
        } else {
          createWidgetErrorMessage(widgetBody, name, version);
          plugin.isConfirmVersion = false;
        }
      }
    }
  }

  async downloadConfiguration(downloadPath) {
    const delimIndex = downloadPath.search(/:id=/);
    const id = delimIndex !== -1 ? downloadPath.split('?id=')[0].slice(delimIndex + 4) : downloadPath.split('?id=')[0];
    const path = delimIndex !== -1 ? downloadPath.slice(0, delimIndex) : '';

    const groups = await this.#interactionSystem.GETRequest('dtcd_utils/v1/user?photo_quality=low').then(response => {
      const groups = response.data.groups;
      if (!groups?.length) return [];
      return groups;
    });
    const groupsForWorkSpaces = groups
      .filter(group => group.name.includes('workspace.'))
      .map(item => item.name.split('.')[1]);

    this.#logSystem.debug(`Trying to download configuration with id:${id}`);
    const { data } = await this.#interactionSystem.GETRequest(`/dtcd_workspaces/v1/workspace/object/${path}?id=${id}`);
    this.#logSystem.debug(`Parsing configuration from response`);

    if (groupsForWorkSpaces.includes(data.title)) {
      this.#router.navigate('/workspaces');
    }

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
    this.#widgets = [];
    this.#editMode = false;
    this.#panelStyles = {};
    this.#tabPanelsConfig = null;

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

  #createPanel(panelParams = {}) {
    const { name, version, guid, toFixPanel, widget, tabIdOrGrid } = panelParams;

    const selector = `#panel-${guid}`;
    const instance = this.installPanel({ name, version, guid, selector });
    const tabId = tabIdOrGrid instanceof GridStack ? this.#getGridIdByObject(tabIdOrGrid) : tabIdOrGrid;

    this.#panels.push({
      guid,
      widget,
      instance,
      toFixPanel,
      position: { tabId },
      meta : instance.constructor.getRegistrationMeta(),
    });
  }

  createCell({ name, version, guid = null, w = 6, h = 8, x = 0, y = 0, tabId, autoPosition = true, toFixPanel }) {
    this.#logSystem.debug(
      `Adding panel-plugin widget with name:'${name}', version: ${version}, w: ${w}, h: ${h}, x: ${x}, y: ${y}, autoPosition:${autoPosition}`
    );
    this.#logSystem.info(`Adding panel widget with name: '${name}', version: '${version}'`);

    if (!guid) {
      const panelID = this.#getPanelId(name);
      guid = `${name}_${panelID}`;
    }

    toFixPanel = Boolean(toFixPanel);

    let targetGrid = this.#gridCollection.get(tabId)?.gridInstance;
    targetGrid = targetGrid ? targetGrid : this.#activeGrid;

    const widget = this.#createWidget(targetGrid, { x, y, w, h, autoPosition, guid, toFixPanel });

    this.#createPanel({ name, version, guid, toFixPanel, widget, tabIdOrGrid: targetGrid });

    return widget;
  }

  deleteCell(guid) {
    this.#logSystem.debug(`Trying to delete cell from workspace with guid: ${guid}`);

    const panel = this.#panels.find(p => p.guid === guid);
    const widget = this.#widgets.find(w => w.guid === guid);

    if (!panel && !widget) {
      this.#logSystem.debug(`No cell element found on workspace with given guid: ${guid}`);
      throw new Error(`Workspace cell with guid "${guid}" not exist`);
    }

    if (panel) {
      const panelIndex = this.#panels.findIndex(p => p.guid === guid);
      this.uninstallPluginByGUID(guid);
      this.#panels.splice(panelIndex, 1);
    }

    if (widget) {
      const widgetIndex = this.#widgets.findIndex(w => w.guid === guid);
      widget.targetGrid.removeWidget(widget.widget);
      this.#widgets.splice(widgetIndex, 1);
    }

    panel?.toFixPanel && this.#deleteGridCellClones(guid);

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
    targetGrid.update(panel.widget, {
      noMove: panel.toFixPanel,
      noResize: panel.toFixPanel,
      locked: panel.toFixPanel,
    });

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

  changeMode(doEdit) {
    doEdit ?? (doEdit = !this.#editMode);
    this.#editMode = Boolean(doEdit);

    const panelBorder = document.querySelectorAll('.grid-stack-item');
    panelBorder.forEach(gridCell => {
      gridCell.classList[this.#editMode ? 'add' : 'remove']('grid-stack-item_editing');
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

    this.#eventSystem.publishEvent('WorkspaceEditModeChanged', {
      editMode: this.#editMode,
    });
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
      this.#notificationSystem &&
        this.#notificationSystem.create('Ошибка на рабочем столе.', errorMsg, {
          floatMode: true,
          floatTime: 5,
          type: 'error',
        });
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

      this.#notificationSystem &&
        this.#notificationSystem.create('Готово!', 'Настройки рабочего стола сохранены.', {
          floatMode: true,
          floatTime: 5,
          type: 'success',
        });
    } catch (error) {
      this.#notificationSystem &&
        this.#notificationSystem.create(
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
        this.#notificationSystem &&
          this.#notificationSystem.create('Ошибка на рабочем столе.', errorMsg, {
            floatMode: true,
            floatTime: 5,
            type: 'error',
          });
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

  /**
   * Send all plugin states on workspace.
   * @returns {Promise<string>} Promise containing a link of the dashboard with stateID
   */
  async getURLDashboardState() {
    this.#logSystem.debug('Start creating URL with plugin states.');

    try {
      const state = this.#collectStatesFromPlugins();
      const response = await this.#interactionSystem.POSTRequest('dtcd_storage_system_backend/v1/state', {
        applicationName: 'DataCAD',
        workspaceID: this.#currentID,
        state,
      });
      response.then(result => {
        const { stateID } = JSON.parse(result);

        if (stateID) {
          const { origin, pathname } = window.location;
          return origin + pathname + `?stateID="${stateID}"`;
        }
      });
    } catch (error) {
      this.#logSystem.error('Error creating URL with plugin states: ' + error.message);
      throw error;
    }
  }

  /**
   * Recovery dashboard state from URL.
   * @param {String} [url] URL with search parameter 'stateID'
   */
  recoveryPluginStateFromUrl(url) {
    this.#logSystem.debug('Start dashboard state recovery from URL.');

    try {
      const urlSearchParams = new URL(typeof url === 'string' ? url : window.location.href).searchParams;
      const stateID = urlSearchParams.get('stateID');
      if (!stateID) return;

      const response = this.#interactionSystem.POSTRequest('dtcd_storage_system_backend/v1/state', {
        applicationName: 'DataCAD',
        stateID,
      });
      response
        .then(result => {
          const dashboardState = JSON.parse(result).state;
          for (const key in dashboardState) {
            if (!Object.hasOwnProperty.call(dashboardState, key)) continue;

            try {
              this.#logSystem.debug(`Start plugin state recovery of '${key}' from URL.`);
              if (typeof Application.autocomplete[key]?.setState === 'function') {
                Application.autocomplete[key].setState(dashboardState[key]);
              }
            } catch (error) {
              this.#logSystem.error(`Error plugin state recovery of '${key}' from URL.`);
              console.error(error);
            }
          }
        })
        .catch(error => {
          throw error;
        });
    } catch (error) {
      this.#logSystem.error('Error recovery dashboard state from URL: ' + error.message);
      this.#notificationSystem &&
        this.#notificationSystem.create('Error.', 'Ошибка восстановления состояния рабочего стола из URL.', {
          floatMode: true,
          floatTime: 5,
          type: 'error',
        });
      throw error;
    }

    this.#logSystem.info('Ended dashboard state recovery from URL.');
    this.#notificationSystem &&
      this.#notificationSystem.create('Выполнено.', 'Данные рабочего стола успешно восстановлены из URL.', {
        floatMode: true,
        floatTime: 5,
        type: 'success',
      });
  }

  #hideTabsPanel() {
    this.#interactionSystem.GETRequest('dtcd_utils/v1/user?photo_quality=low').then(response => {
      const groups = response.data.groups;
      if (!groups?.length) return;

      for (let i = 0; i < groups.length; i++) {
        this.#vueComponent.toggleVisibleTabByName(groups[i].name);
      }
    });
  }

  #collectStatesFromPlugins() {
    const pluginsState = {};

    this.#panels.forEach(panel => {
      if (typeof panel.instance?.getState === 'function') {
        pluginsState[panel.guid] = panel.instance.getState();
      }
    });

    return pluginsState;
  }

  #createTabsSwitcher() {
    this.#workspaceContainer.innerHTML = '';
    this.#tabsCollection = [];

    this.#tabsSwitcherInstance = new TabsSwitcher({
      tabsCollection: this.#tabsCollection,
    });

    const data = {
      guid: this.#guid,
      interactionSystem: this.#interactionSystem,
      logSystem: this.#logSystem,
      eventSystem: this.#eventSystem,
      plugin: this,
      tabsCollection: this.#tabsCollection,
      editMode: this.#editMode,
      visibleNavBar: false,
      tabsSwitcherInstance: this.#tabsSwitcherInstance,
    };

    const { default: VueJS } = this.getDependence('Vue');
    this.#vueComponent?.$destroy && this.#vueComponent.$destroy();
    const panel = new VueJS({
      data: () => data,
      render: h => h(TabsPanelComponent),
    }).$mount();
    this.#vueComponent = panel.$children[0];

    this.#tabsSwitcherInstance.htmlElement.appendChild(this.#vueComponent.$el);
    this.#workspaceContainer.appendChild(this.#tabsSwitcherInstance.htmlElement);

    this.#tabsSwitcherInstance.htmlElement.addEventListener('tab-active', this.#handleTabsSwitcherActive);
    this.#tabsSwitcherInstance.htmlElement.addEventListener('tab-delete', this.#handleTabsSwitcherDelete);
    this.#tabsSwitcherInstance.htmlElement.addEventListener('tab-add', this.#handleTabsSwitcherAdd);
    this.#tabsSwitcherInstance.htmlElement.addEventListener('tab-copy', this.#handleTabsSwitcherCopy);

    this.#gridCollection = new Map();

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
      const tabId = this.#vueComponent.addNewTab({ id: this.#getTabIdUrlParam() });
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

    const gridstackChangedOpts = this.#editMode ? { ...gridstackOptions, staticGrid: false } : gridstackOptions;
    const newGrid = GridStack.init(gridstackChangedOpts, gridStackEl);

    this.#gridCollection.set(tabId, {
      isActive: false,
      gridInstance: newGrid,
    });

    this.#panels.forEach(panel => {
      if (panel.toFixPanel) this.#createGridCellClones(panel.guid);
    });
  };

  #handleTabsSwitcherCopy = event => {
    const tabId = event.detail?.tabId;
    const collection = event.detail?.collection;
    const id = event.detail?.id;
    const plugins = this.getPluginConfig().plugins;

    collection.forEach(tab => {
      // Формирования списка плагинов
      const targetPlugins = plugins.reduce((acc, plugin) => {
        if (plugin.meta?.type === 'panel') {
          if (plugin?.position?.tabId === tab?.id && plugin?.position?.tabId === id) {
            acc.push(plugin);
          }
        }
        return acc;
      }, []);

      // инифиализация плагинов на новой вкладке
      const pluginsGuid = targetPlugins.reduce((acc, plugin) => {
        const { name, version } = plugin.meta;
        const { h, w, x, y } = plugin.position;
        const autoPosition = false;
        const toFixPanel = false;
        const widget = this.createCell({ name, version, guid: null, w, h, x, y, tabId, autoPosition, toFixPanel });
        const currentPlugin = Application.autocomplete[widget.getAttribute('gs-id')];
        if (plugin.config) {
          currentPlugin.setPluginConfig(plugin.config);
        }
        acc.push({
          originPlugin: plugin.guid,
          targetPlugin: widget.getAttribute('gs-id'),
        });
        return acc;
      }, []);

      pluginsGuid.forEach(guid => {
        const subscriptions = this.#eventSystem.subscriptions.filter(
          item => item.event.guid === guid.originPlugin && item.subscriptionName !== undefined
        );
        if (subscriptions.length > 0) {
          subscriptions.forEach(event => {
            let eventGuid,
              actionGuid = null;
            if (event.subscriptionName) {
              eventGuid = pluginsGuid.find(cellGuid => cellGuid.originPlugin === event.event.guid);
              if (event.action.guid) {
                actionGuid = pluginsGuid.find(cellGuid => cellGuid.originPlugin === event.action.guid);
              } else {
                actionGuid = event.action.guid;
              }
              if (!actionGuid?.targetPlugin) {
                this.#eventSystem.registerCustomAction(event.action.name + '-' + tabId, event.action.callback);
              }
              this.#eventSystem.subscribe({
                eventGUID: eventGuid.targetPlugin,
                eventName: event.event.name,
                actionGUID: actionGuid?.targetPlugin ? actionGuid?.targetPlugin : 'Пользовательское событие',
                actionName: actionGuid?.targetPlugin ? event.action.name : event.action.name + '-' + tabId,
                eventArgs: event.action.args,
                subscriptionName: event.subscriptionName + '-' + tabId,
              });
            }
          });
        }
      });
    });
  };

  #handleTabsSwitcherActive = event => {
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

    if (this.typeInit === 'TYPE-2') {
      this.#createPanelsInActiveTab(activeTabId);
    }

    this.#panels.forEach(panel => {
      if (panel.toFixPanel) {
        this.#changeFixedPanelPosition(panel);
      }
      if (typeof panel.instance.setVisible === 'function') {
        panel.instance.setVisible(activeTabId === panel?.position.tabId);
      }
    });
  };

  async #createPanelsInActiveTab(activeTabId) {
    const panelPlugins = [];

    for (let i = 0; i < this.#hiddenPanelPlugins.length; i++) {
      const plugin = this.#hiddenPanelPlugins[i];

      if (!plugin) continue;

      const {
        meta,
        config,
        position = {},
        toFixPanel,
      } = plugin;

      if (position.tabId !== activeTabId) continue;

      let guid = plugin.guid;
      let originalVersion = meta.version;

      const widget = this.#createWidget(null, {
        ...position,
        guid,
        toFixPanel,
        autoPosition: false,
      });

      const id = `${meta.name}_${originalVersion}`;

      panelPlugins.push({
        ...meta,
        id,
        guid,
        config,
        widget,
        toFixPanel,
        version: originalVersion,
        tabIdOrGrid: position.tabId,
      });

      try {
        if (this.#existedPlugins.hasOwnProperty(id) || this.#notFoundPlugins.includes(id)) continue;

        const pluginClass = this.getPlugin(meta.name, originalVersion, 3);
        const { version } = pluginClass?.getRegistrationMeta();

        this.#existedPlugins[id] = { version, originalVersion, pluginClass };
      } catch (error) {
        this.#notFoundPlugins.push(id);
        console.error(error);
        this.#notificationSystem.create(
          'Отсутствует плагин',
          `Плагин не найден: ${meta.name} ${meta.version}`,
          { floatMode: true, floatTime: 5, type: 'warning' },
        );
      } finally {
        this.#hiddenPanelPlugins[i] = null;
      }
    }

    this.#createPanelPluginsInstances(panelPlugins);
  }

  #setTabIdUrlParam(tabId) {
    if (!tabId) return;

    if (this.currentWorkspaceID) {
      const urlSearchParams = new URLSearchParams(window.location.search);
      urlSearchParams.set('ws-tab-id', tabId);
      this.#router.replace(`${window.location.pathname}?${urlSearchParams.toString()}`);
    }
  }

  #getTabIdUrlParam() {
    const urlSearchParams = new URLSearchParams(window.location.search);
    return urlSearchParams.get('ws-tab-id');
  }

  #handleTabsSwitcherDelete = event => {
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
    for (const [id, data] of this.#gridCollection) {
      if (data?.gridInstance === desiredGrid) return id;
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

    let borderStyles = '.grid-stack > .grid-stack-item .grid-stack-item-content{';

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

  #handleTypeInitChange = event => {
    const { value } = event.target;
    this.typeInit = value;
  };

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
      gridData.gridInstance.getGridItems().forEach(gridCell => {
        // find doubles grid items
        if (gridCell.getAttribute('gs-id') === guid) {
          isExistGridCell = true;
          return;
        }
      });

      if (!isExistGridCell) {
        this.#createWidget(gridData.gridInstance, {
          x,
          y,
          w,
          h,
          autoPosition: false,
          guid,
          toFixPanel: true,
          empty: true,
        });
      }
    });

    this.#logSystem.info(`End of creation grid cell clones for panel ${guid}.`);
  }

  #deleteGridCellClones(guid) {
    this.#logSystem.debug(`Start of deleting grid cell clones for panel ${guid}.`);

    this.#gridCollection.forEach((gridData, key) => {
      gridData.gridInstance.getGridItems().forEach(gridCell => {
        if (gridCell.getAttribute('gs-id') === guid) {
          if (gridCell.hasAttribute('data-empty-item')) {
            const index = this.#widgets.findIndex(w => w.widget === gridCell);
            gridData.gridInstance.removeWidget(gridCell);
            this.#widgets.splice(index, 1);
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
      tabId,
    } = gridItemOptions;

    if (!(targetGrid instanceof GridStack)) {
      targetGrid = this.#gridCollection.get(tabId)?.gridInstance;
      targetGrid ??= this.#activeGrid;
    }

    const gridStackItemEl = document.createElement('div');
          gridStackItemEl.className = `grid-stack-item${this.#editMode ? ' grid-stack-item_editing' : ''}`;
          gridStackItemEl.innerHTML = gridStackItemHtml;

    if (empty) {
      gridStackItemEl.setAttribute('data-empty-item', '');
    } else {
      gridStackItemEl.querySelector('.VisualizationContainer-js')
                  .setAttribute('id', `panel-${guid}`);
    }

    const widget = targetGrid.addWidget(
      gridStackItemEl,
      {
        x,
        y,
        w,
        h,
        autoPosition,
        id,
        locked: toFixPanel,
        noMove: toFixPanel,
        noResize: toFixPanel,
      }
    );

    widget.addEventListener('click', () => {
      if (!this.#editMode) {
        const panel = this.#panels.find(p => p.guid === guid);
        panel && this.#eventSystem.publishEvent('WorkspaceCellClicked', { guid });
      }
    });

    widget
      .querySelector('.close-panel-button')
      .addEventListener('click', this.deleteCell.bind(this, guid));

    widget
      .querySelector('.fix-panel-button')
      .addEventListener('click', this.toggleFixPanel.bind(this, guid));

    this.#widgets.push({ guid, widget, targetGrid });

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

    this.#activeGrid.getGridItems().forEach(gridCell => {
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

  setActiveTab(tabID) {
    this.#logSystem.debug(`Trying to select tab: ${tabID}`);

    const tab = this.tabsCollection.find(tab => tabID === tab.id);

    if (!tab) {
      return this.#logSystem.debug(`Tab with ID ${tabID} not found`);
    }

    this.#vueComponent.setActiveTab(tabID);

    this.#logSystem.debug(`Tab selected: ${tabID}`);
    this.#eventSystem.publishEvent('WorkspaceTabSelectedProgrammly', tab);
  }

  /**
   * @returns {Array<string>} Array of GUIDs of widgets (panels on workspace).
   */
  getGUIDListOfWidgets() {
    return this.#widgets.map((widget) => widget.guid);
  }
}
