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
  #addingOptions;
  #numberPanelIncrement;

  static getRegistrationMeta() {
    return {
      name: 'WorkspaceSystem',
      type: 'core',
      title: 'Система рабочего стола',
      version: '0.2.0',
      withDependencies: true,
      init: false,
      priority: 2,
    };
  }

  constructor(guid) {
    super();
    this.#guid = guid;
    this.#editMode = false;
    this.#eventSystem = new EventSystemAdapter();
    this.#interactionSystem = new InteractionSystemAdapter();
    this.#logSystem = new LogSystemAdapter();
    this.#panels = [];
    this.#defaultConfiguration = {
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
            y: 3,
            w: 6,
            h: 6,
          },
          metadata: {},
        },
      ],
      subscriptions: [
        {
          event: {
            name: 'WorkspaceSelection',
            guid: 'guid2',
          },
          action: {
            name: 'downloadConfiguration',
            guid: 'guid1',
          },
        },
      ],
    };

    this.#currentConfiguration = {};
    const el = document.createElement('div');
    el.setAttribute('class', 'grid-stack');
    el.style = 'width:100%;height:100%';
    document.body.appendChild(el);

    // GRIDSTACK INSTANCE OPTIONS
    this.#grid = GridStack.init({
      float: false,
      draggable: {
        handle: '.handle-drag-of-panel',
      },
      resizable: {
        handles: 'e, se, s, sw, w, nw, n, ne',
      },
      margin: 0,
      staticGrid: true,
    });

    this.#addingOptions = {
      autoPosition: true,
      w: 3,
      h: 3,
    };

    this.#numberPanelIncrement = 0;
  }
  init() {
    this.setConfiguration(this.#defaultConfiguration);
  }

  downloadConfiguration(eventObject) {
    const { id } = eventObject.args;
    this.#interactionSystem.GETRequest(`/v2/workspace/object?id=${id}`).then(response => {
      this.#currentConfiguration = response.data;
      this.setConfiguration(this.#currentConfiguration);
    });
  }

  resetConfiguration() {
    this.#panels.forEach(panel => {
      this.#grid.removeWidget(panel.widget);
      if (panel?.plugin?.beforeDelete) panel.plugin.beforeDelete();
      this.uninstallPluginByInstance(panel.plugin);
    });
    this.#panels = [];
  }
  setDefaultConfiguration() {
    if (this.#editMode) this.changeMode();
    this.setConfiguration(this.#defaultConfiguration);
  }
  setConfiguration(configuration) {
    this.resetConfiguration();
    /*
      for core in systems:
        instance = getSystem(core.name)
        if ! instance:
          return
        guid = getGUID(instance)
        if instance.verion != core.version:
          return

        {
          core.guid: guid => 'guid1' : 'guid10'
        }

      for panel in panels:
        if !panel.class:
          return
        if penel.class.getRegistrationMeta().version != panel.version:
          return
        instance = installPanel(panel)
        instance.initMetadata(panel.meta)
        guid = getGUID(instance)

        {
          append(panel.guid: guid => 'guid1' : 'guid10')
        }

      for sub in subscriptions:
        const instance = getInstanceByGUID(guidMap[sub.event.guid])
        PubSub.subscribe(
          sub.event.name + guidMap[sub.event.guid],
          instance[sub.action.name].bind(instance)
        )
    */
    let guidMap = new Map();
    configuration.systems.forEach(system => {
      const systemInstance = this.getSystem(system.name);
      const systemGUID = this.getGUID(systemInstance);
      guidMap.set(system.guid, systemGUID);
    });

    configuration.panels.forEach(panel => {
      let widget;
      let plugin;
      if (panel.undeletable) {
        widget = this.#grid.addWidget(
          `<div class="grid-stack-item">
          <div class="grid-stack-item-content handle-drag-of-panel">
            <div id="panel-${panel.name}"></div>
          </div>
        </div>`,
          panel.position
        );
        plugin = this.installPlugin(panel.name, `#panel-${panel.name}`);
      } else {
        const obj = this.createCell(panel.name, panel.position);
        widget = obj.widget;
        plugin = obj.instance;
      }
      this.#panels.push({ widget, plugin });
      const pluginGUID = this.getGUID(plugin);
      guidMap.set(panel.guid, pluginGUID);
    });

    configuration.subscriptions.forEach(sub => {
      const instance = this.getInstance(guidMap.get(sub.action.guid));
      const eventName = sub.event.name + '[' + guidMap.get(sub.event.guid) + ']';
      PubSub.subscribe(eventName, instance[sub.action.name].bind(instance));
    });
  }
  createEmptyCell(autoPosition = true, w = null, h = null, x = null, y = null) {
    //TODO: Prettify next assignments
    w = Number.isInteger(w) ? w : this.#addingOptions.w;
    h = Number.isInteger(h) ? h : this.#addingOptions.h;
    x = Number.isInteger(x) ? x : this.#addingOptions.x;
    y = Number.isInteger(y) ? y : this.#addingOptions.y;

    const currentNumberPanel = new Number(this.#numberPanelIncrement);

    // TODO: Replace on WEB-COMPONENT with style!
    const widget = this.#grid.addWidget(
      `
			<div class="grid-stack-item">
        <div class="grid-stack-item-content">
          <div class="handle-drag-of-panel gridstack-panel-header" style="display:${
            this.#editMode ? 'flex' : 'hide'
          }">
            <div id="closePanelBtn-${currentNumberPanel}" class="close-panel-button">
              <i  class="fas fa-lg fa-times"></i>
            </div>
          </div>
          <div class="gridstack-content-container${
            this.#editMode ? ' gridstack-panel-overlay' : ''
          }">
            <div id="panel-${currentNumberPanel}">
            </div>
          <div>
				</div>
			</div>
		`,
      { autoPosition, x, y, w, h, id: currentNumberPanel }
    );

    const selectEl = document.createElement('select');
    selectEl.classList = 'default-select-panel';
    selectEl.options[0] = new Option('Выбрать панель ↓');
    let nextOptionIndex = 1;
    this.getPanels().forEach(plug => {
      const { type, title, name } = plug;
      if (type === 'panel' && name !== 'MenuPanel') {
        selectEl.options[nextOptionIndex] = new Option(title, name);
        nextOptionIndex++;
      }
    });

    let instanceOfPanel;
    selectEl.onchange = evt => {
      const idCell = evt.target.parentElement.getAttribute('id');
      const workspaceCellID = idCell.split('-').pop();

      // The next line is needed to delete an instance
      instanceOfPanel = this.installPlugin(selectEl.value, `#panel-${workspaceCellID}`);
      let obj = this.#panels.find(panel => panel.widget === widget);
      obj.plugin = instanceOfPanel;
    };

    document.getElementById(`panel-${currentNumberPanel}`).appendChild(selectEl);

    // closePanelBtn
    document
      .getElementById(`closePanelBtn-${currentNumberPanel}`)
      .addEventListener('click', evt => {
        this.#grid.removeWidget(widget);
        this.uninstallPluginByInstance(instanceOfPanel);
      });
    this.#panels.push({ widget });
    this.#numberPanelIncrement++;
  }

  createCell(panelName, position) {
    const currentNumberPanel = new Number(this.#numberPanelIncrement);
    const widget = this.#grid.addWidget(
      `
        <div class="grid-stack-item">
          <div class="grid-stack-item-content">
            <div class="handle-drag-of-panel gridstack-panel-header" style="display:${
              this.#editMode ? 'flex' : 'hide'
            }">
              <div id="closePanelBtn-${currentNumberPanel}" class="close-panel-button">
                <i  class="fas fa-lg fa-times"></i>
              </div>
            </div>
            <div class="gridstack-content-container${
              this.#editMode ? ' gridstack-panel-overlay' : ''
            }">
              <div id="panel-${currentNumberPanel}">
              </div>
            <div>
          </div>
        </div>
      `,
      position
    );

    let instance = this.installPlugin(panelName, `#panel-${currentNumberPanel}`);
    document
      .getElementById(`closePanelBtn-${currentNumberPanel}`)
      .addEventListener('click', evt => {
        this.#grid.removeWidget(widget);
        this.uninstallPluginByInstance(instance);
      });

    this.#numberPanelIncrement++;
    return { instance, widget };
  }

  // _mountPanelForDevelop(name, w = null, h = null, x = null, y = null) {
  //   const numberPanel = this.createEmptyCell(false, w, h, x, y);
  //   this.installPlugin(name, `#panel-${numberPanel}`);
  // }

  compactAllPanels() {
    this.#grid.compact();
  }
  changeMode() {
    const panelHeaders = document.querySelectorAll('.gridstack-panel-header');
    panelHeaders.forEach(header => {
      header.style.display = this.#editMode ? 'none' : 'flex';
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
  }
}
