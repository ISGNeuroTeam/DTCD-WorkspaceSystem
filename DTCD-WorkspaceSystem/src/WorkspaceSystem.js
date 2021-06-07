import './styles/panel.css';
import './styles/gridstack.min.css';

import {
  EventSystemAdapter,
  SystemPlugin,
  InteractionSystemAdapter,
  LogSystemAdapter,
} from './../../DTCD-SDK/index';

import { GridStack } from 'gridstack';
import 'gridstack/dist/h5/gridstack-dd-native';

export class Plugin extends SystemPlugin {
  #guid;
  #editMode;
  #eventSystem;
  #interactionSystem;
  #logSystem;
  #panels;
  #defaultConfiguration;
  #currentConfiguration;
  #grid;
  #numberPanelIncrement;
  #emptyConfiguration;

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
  get panels() {
    return this.#panels;
  }
  constructor(guid) {
    super();
    this.#guid = guid;
    this.#editMode = false;
    this.#eventSystem = new EventSystemAdapter();
    this.#interactionSystem = new InteractionSystemAdapter();
    this.#logSystem = new LogSystemAdapter(this.#guid, 'WorkspaceSystem');
    this.#panels = [];
    this.#defaultConfiguration = {
      title: 'Default workspace configuration',
      systems: [
        {
          name: 'WorkspaceSystem',
          version: '0.2.0',
          guid: 'guid1',
          metadata: {},
        },
      ],
      panels: [
        {
          name: 'WorkspacePanel',
          version: '0.1.0',
          guid: 'guid2',
          undeletable: true,
          position: {
            x: 3,
            y: 1,
            w: 5,
            h: 5,
          },
          metadata: {},
        },
      ],
      subscriptions: [],
    };
    this.#emptyConfiguration = {
      title: 'Empty configuration',
      systems: [],
      panels: [
        {
          name: 'MenuPanel',
          undeletable: true,
          version: '1.0.0',
          guid: 'guid2',
          position: {
            x: 0,
            y: 0,
            w: 12,
            h: 1,
          },
          metadata: {},
        },
      ],
      subscriptions: [],
    };

    this.#currentConfiguration = {};
    const el = document.createElement('div');
    el.setAttribute('class', 'grid-stack');
    el.style = 'width:100%;height:100%';
    document.body.appendChild(el);

    // GRIDSTACK INSTANCE OPTIONS
    this.#grid = GridStack.init({
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

  init() {
    this.#logSystem.debug('Initiating default workspace configuration');
    this.#setConfiguration(this.#defaultConfiguration);
  }
  async getConfigurationList() {
    const response = await this.#interactionSystem.GETRequest('/v2/workspace/object');
    return response.data;
  }

  async #downloadConfiguration(id) {
    this.#logSystem.debug(`Trying to download configuration with id:${id}`);
    try {
      const response = await this.#interactionSystem.GETRequest(`/v2/workspace/object?id=${id}`);
      this.#logSystem.debug(`Parsing configuration from response`);
      this.#currentConfiguration = JSON.parse(response.data.content);
      this.#setConfiguration(this.#currentConfiguration);
    } catch (err) {
      this.#logSystem.error(
        `Error occured while downloading workspace configuration: ${err.message}`
      );
    }
  }

  async setConfiguration(id) {
    if (typeof id != 'number') {
      this.#logSystem.error('Wrong argument type: must be integer');
      return;
    }
    await this.#downloadConfiguration(id);
    this.#setConfiguration(this.#currentConfiguration);
  }

  #setConfiguration(configuration) {
    this.resetConfiguration();
    this.#logSystem.info(
      `Setting workspace configuration (id:${configuration.id}, title:${configuration.title})`
    );
    let guidMap = new Map();
    this.#logSystem.debug('Mapping guids of systems from configuration');
    configuration.systems.forEach(system => {
      const systemInstance = this.getSystem(system.name);
      const systemGUID = this.getGUID(systemInstance);
      this.#logSystem.debug(`Mapped guid of ${system.name} from ${system.guid} to ${systemGUID}`);
      guidMap.set(system.guid, systemGUID);
      system.guid = systemGUID;
    });

    this.#logSystem.debug('Initializing panels from configuration');
    configuration.panels.forEach(panel => {
      let widget;
      const { w, h, x, y } = panel.position;
      if (panel.name === '') {
        this.#logSystem.debug('Creating empty cell');
        this.createEmptyCell(w, h, x, y, false);
        return;
      }
      if (panel.undeletable) {
        this.#logSystem.debug(`Creating undeletable widget for panel: ${panel.name}`);
        widget = this.#createUndeletableCell(panel);
      } else {
        this.#logSystem.debug(`Creating widget for panel: ${panel.name}`);
        widget = this.createCell(panel.name, w, h, x, y, false);
      }
      const plugin = this.#panels.find(panel => panel.widget === widget).plugin;
      const pluginGUID = this.getGUID(plugin);
      this.#logSystem.debug(`Mapping guid of ${panel.name} from ${panel.guid} to ${pluginGUID}`);
      guidMap.set(panel.guid, pluginGUID);
      panel.guid = pluginGUID;

      if (plugin.setMetadata) {
        this.#logSystem.debug(`Setting metadata for panel ${panel.name}`);
        plugin.setMetadata();
      } else
        this.#logSystem.warn(
          `Plugin ${panel.name} v${panel.version} doesn't provide public method for setting metadata`
        );
    });
    this.#logSystem.debug(`Initializing subscriptions from configuration`);
    configuration.subscriptions.forEach(sub => {
      sub.action.guid = guidMap.get(sub.action.guid);
      sub.event.guid = guidMap.get(sub.event.guid);
      const instance = this.getInstance(sub.action.guid);
      const eventName = sub.event.name + '[' + sub.event.guid + ']';
      this.#logSystem.debug(
        `Subscribing event '${eventName}' to plugin action '${sub.action.name}' with guid ${sub.action.guid}`
      );
      PubSub.subscribe(eventName, instance[sub.action.name].bind(instance));
    });
  }

  setDefaultConfiguration() {
    if (this.#editMode) this.changeMode();
    this.#setConfiguration(this.#defaultConfiguration);
  }

  async saveConfiguration() {
    this.#logSystem.info('Saving current configuration');
    this.#currentConfiguration.panels = [];
    this.#panels.forEach(panel => {
      let object;
      if (!panel.plugin) {
        object = {
          name: '',
          undeletable: false,
          position: panel.widget.gridstackNode._orig,
        };
      } else {
        object = {
          guid: panel.guid,
          name: panel.name,
          version: panel.version,
          position: panel.widget.gridstackNode._orig,
          undeletable: panel.undeletable,
        };
        if (!panel.plugin.getMetadata) object.metadata = {};
        else object.metadata = panel.plugin.getMetadata();
      }
      this.#currentConfiguration.panels.push(object);
    });
    this.#logSystem.debug('Sending updated configuration to server');
    this.#interactionSystem.PUTRequest('/v2/workspace/object', [
      {
        id: this.#currentConfiguration.id,
        title: this.#currentConfiguration.title,
        content: JSON.stringify(this.#currentConfiguration),
      },
    ]);
  }

  resetConfiguration() {
    this.#logSystem.debug('Resetting current workspace configuration');
    this.#panels.forEach(panel => {
      this.#logSystem.debug(
        `Removing workspace widget id:${panel.widget.gridstackNode._id}, name:${
          panel.name ? panel.name : 'Empty cell'
        }`
      );
      this.#grid.removeWidget(panel.widget);
      this.#logSystem.debug(
        `Uninstalling widget plugin: ${
          panel.name ? panel.name + ' v' + panel.version : 'empty cell with no plugin'
        } `
      );
      this.uninstallPluginByInstance(panel.plugin);
    });
    this.#logSystem.debug(`Clearing panels array`);
    this.#panels = [];
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

  async createEmptyConfiguration(configurationTitle) {
    this.#logSystem.debug(
      `Trying to create new empty configuration with title:'${configurationTitle}`
    );
    let tempConf = this.#emptyConfiguration;
    tempConf.title = configurationTitle;
    try {
      this.#logSystem.debug(`Sending request to create configurations`);
      await this.#interactionSystem.POSTRequest('/v2/workspace/object', [
        {
          title: configurationTitle,
          content: JSON.stringify(tempConf),
        },
      ]);
      this.#logSystem.info(
        `Successfully created new configuration with title:'${configurationTitle}'`
      );
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
          <div>
				</div>
			</div>
		`,
      { x, y, w, h, autoPosition, id: panelID }
    );

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

    let instanceOfPanel;
    selectEl.onchange = evt => {
      this.#logSystem.info(`Selected plugin '${selectEl.value}' in empty cell with id ${panelID}`);
      const idCell = evt.target.parentElement.getAttribute('id');
      const workspaceCellID = idCell.split('-').pop();
      const { name, version } = this.getPlugin(selectEl.value).getRegistrationMeta();
      instanceOfPanel = this.installPlugin(selectEl.value, `#panel-${workspaceCellID}`);
      const guid = this.getGUID(instanceOfPanel);
      let obj = this.#panels.find(panel => panel.widget === widget);
      Object.assign(obj, {
        plugin: instanceOfPanel,
        version,
        name,
        guid,
        undeletable: false,
      });
    };

    document.getElementById(`panel-${panelID}`).appendChild(selectEl);

    // closePanelBtn
    document.getElementById(`closePanelBtn-${panelID}`).addEventListener('click', evt => {
      this.#panels = this.#panels.filter(panel => panel.widget !== widget);
      this.#grid.removeWidget(widget);
      if (instanceOfPanel) this.uninstallPluginByInstance(instanceOfPanel);
      this.#logSystem.info(`Widget with id ${panelID} was removed from workspace`);
    });

    this.#panels.push({ widget });
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

  selectPluginInCell(cellID, pluginName) {
    this.#logSystem.debug(
      `Trying to select panel-plugin '${pluginName}' in empty cell with id:${cellID}`
    );
    const panel = this.#panels.find(
      panel => !panel.plugin && panel.widget.gridstackNode._id === cellID
    );
    if (!panel) {
      this.#logSystem.error(`Cannot find empty cell with given cellID:${cellID}!`);
      return;
    }
    const selectElement = panel.widget.querySelector('select');
    const optionElements = selectElement.options;
    let options = [];
    for (let i = 0; i < optionElements.length; i++) {
      options.push(optionElements[i].value);
    }
    if (!options.includes(pluginName)) {
      this.#logSystem.error(`Cannot find plugin with the given name:${pluginName}!`);
      return;
    }
    const panelIndex = options.indexOf(pluginName);
    this.#logSystem.debug(`Setting select selected option index to '${panelIndex}`);
    selectElement.selectedIndex = panelIndex;
    this.#logSystem.debug(`Dispatching select event 'change' to trigger callback`);
    const changeEvent = new Event('change');
    selectElement.dispatchEvent(changeEvent);
  }

  #createUndeletableCell(panel) {
    const { name, version } = this.getPlugin(panel.name).getRegistrationMeta();
    const options = { ...panel.position, autoPosition: false };
    const widget = this.#grid.addWidget(
      `<div class="grid-stack-item">
      <div class="grid-stack-item-content handle-drag-of-panel">
        <div id="panel-${panel.name}"></div>
      </div>
    </div>`,
      options
    );
    const plugin = this.installPlugin(panel.name, `#panel-${panel.name}`);
    const guid = this.getGUID(plugin);
    this.#panels.push({ widget, plugin, name, version, guid, undeletable: true });
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
}
