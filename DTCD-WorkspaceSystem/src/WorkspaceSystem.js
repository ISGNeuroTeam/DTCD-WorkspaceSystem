import './styles/panel.css';
import './styles/header.css';
import './styles/footer.css';

import headerTemplate from './templates/header.html';
import footerTemplate from './templates/footer.html';

import {
  EventSystemAdapter,
  SystemPlugin,
  InteractionSystemAdapter,
  LogSystemAdapter,
} from './../../DTCD-SDK/index';

import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import 'gridstack/dist/h5/gridstack-dd-native';

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
  #guid;
  #editMode;
  #eventSystem;
  #interactionSystem;
  #logSystem;
  #panels;
  #grid;
  #numberPanelIncrement;
  #emptyConfiguration;
  #defaultConfiguration;
  #currentConfiguration;

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

  get currentConfiguration() {
    return this.#currentConfiguration;
  }

  constructor(guid) {
    super();
    this.#guid = guid;
    this.#editMode = false;
    this.#eventSystem = new EventSystemAdapter(guid);
    this.#eventSystem.registerPluginInstance(this);
    this.#interactionSystem = new InteractionSystemAdapter();
    this.#logSystem = new LogSystemAdapter(this.#guid, 'WorkspaceSystem');
    this.#panels = [];
    this.#defaultConfiguration = defaultConfiguration;
    this.#emptyConfiguration = emptyConfiguration;
    this.#currentConfiguration = {};

    // ---- TEMPLATES ----
    const header = document.createElement('div');
    header.innerHTML = headerTemplate;
    header.classList.add('workspace-header');
    document.body.appendChild(header);

    const gridBody = document.createElement('div');
    gridBody.setAttribute('class', 'grid-stack');
    gridBody.style = 'width:100%;height:100%';
    document.body.appendChild(gridBody);

    const footer = document.createElement('div');
    footer.innerHTML = footerTemplate;
    footer.classList.add('workspace-footer');
    document.body.appendChild(footer);

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

  async init() {
    const parsedURL = new URLSearchParams(window.location.search);
    if (!parsedURL.has('workspace')) {
      this.#logSystem.debug('Initializing default workspace configuration');
      this.#setConfiguration(this.#defaultConfiguration);
      return;
    }
    const id = parseInt(parsedURL.get('workspace'));
    this.#logSystem.debug(`Initializing configuration from url param with id:${id}`);
    await this.setConfiguration(id);
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

  async #downloadConfiguration(id) {
    this.#logSystem.debug(`Trying to download configuration with id:${id}`);
    try {
      const response = await this.#interactionSystem.GETRequest(`/v2/workspace/object?id=${id}`);
      this.#logSystem.debug(`Parsing configuration from response`);
      const data = response.data;
      let content = JSON.parse(data.content);
      content['id'] = data.id;
      content['title'] = data.title;
      this.#currentConfiguration = content;
    } catch (err) {
      this.#logSystem.error(
        `Error occured while downloading workspace configuration: ${err.message}`
      );
    }
  }

  #setConfiguration(configuration) {
    this.resetConfiguration();
    this.#logSystem.info(
      `Setting workspace configuration (id:${configuration.id}, title:${configuration.title})`
    );
    // ---- COLUMN ----
    if (typeof configuration.column != 'undefined') this.setColumn(configuration.column);

    // ---- GUID-MAP ----
    let guidMap = new Map();

    // ---- systems ----
    this.#logSystem.debug('Mapping guids of systems from configuration');
    configuration.systems.forEach(system => {
      const instance = this.getSystem(system.name);
      const currentGUID = this.getGUID(instance);
      this.#logSystem.debug(`Mapped guid of ${system.name} from ${system.guid} to ${currentGUID}`);
      guidMap.set(system.guid, currentGUID);
      system.guid = currentGUID;
    });

    // ---- panels ----
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

    // ---- EVENT-SYSTEM ----
    this.#logSystem.debug(`Initializing subscriptions from configuration`);
    configuration.subscriptions.forEach(sub => {
      sub.action.guid = guidMap.get(sub.action.guid);
      sub.event.guid = guidMap.get(sub.event.guid);
    });
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
    await this.#downloadConfiguration(id);
    this.#setConfiguration(this.#currentConfiguration);
  }

  async saveConfiguration() {
    this.#logSystem.info('Saving current configuration');
    this.#currentConfiguration.panels = this.#panels.map(panel => {
      let panelMeta;
      if (!panel.plugin) {
        panelMeta = {
          name: '',
          undeletable: false,
          position: panel.widget.gridstackNode._orig,
        };
      } else {
        const { guid, name, version, widget, undeletable } = panel;
        panelMeta = {
          position: widget.gridstackNode._orig,
          guid,
          name,
          version,
          undeletable,
        };
        if (!panel.plugin.getMetadata) panelMeta.metadata = {};
        else panelMeta.config = panel.plugin.getMetadata();
      }
      return panelMeta;
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

  goToHomePage() {
    if (this.#editMode) this.changeMode();
    this.#setConfiguration(this.#defaultConfiguration);
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
          </div>
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

  setColumn(count) {
    const head = document.head || document.getElementsByTagName('head')[0];

    let styleEl = head.querySelector('style#gridstack-custom-style');
    if (styleEl) head.removeChild(styleEl);

    if (typeof count !== 'undefined') {
      this.#grid.column(count);
      this.#grid.el.querySelectorAll('.grid-stack-item').forEach(itemEl => {
        itemEl.style.minWidth = `${100 / count}%`;
      });
      styleEl = document.createElement('style');
      styleEl.setAttribute('id', 'gridstack-custom-style');
      styleEl.setAttribute('type', 'text/css');
      let style = '';

      for (let i = 0; i < count + 1; i++) {
        style += `
      .grid-stack > .grid-stack-item[gs-w='${i}']{width:${(100 / count) * i}%}
      .grid-stack > .grid-stack-item[gs-x='${i}']{left:${(100 / count) * i}%}
      .grid-stack > .grid-stack-item[gs-min-w='${i}']{min-width:${(100 / count) * i}%}
      .grid-stack > .grid-stack-item[gs-max-w='${i}']{max-width:${(100 / count) * i}%}
      `;
      }

      styleEl.innerHTML = style;
      head.appendChild(styleEl);
      this.#currentConfiguration.column = count;
    }
  }
}
