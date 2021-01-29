import './styles/panel.css';
import './styles/gridstack.min.css';

import {EventSystemAdapter, SystemPlugin} from './../../DTCD-SDK/index';

export class Plugin extends SystemPlugin {
	static getRegistrationMeta() {
		return {
			name: 'WorkspaceSystem',
			type: 'core',
			title: 'Система рабочего стола',
		};
	}

	constructor(guid, styleSystem) {
		super();
		this.guid = guid;
		this.editMode = false;
		this.eventSystem = new EventSystemAdapter();

		const el = document.createElement('div');
		el.setAttribute('class', 'grid-stack');
		el.style = 'width:100%;height:100%';
		document.body.appendChild(el);

		// GRIDSTACK INSTANCE OPTIONS
		this.grid = GridStack.init({
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

		this.addingOptions = {
			w: 3,
			h: 3,
			x: 1,
			y: 1,
		};

		// MenuPanel
		this.grid.addWidget(
			`	<div class="grid-stack-item">
					<div class="grid-stack-item-content handle-drag-of-panel">
						<div id="panel-MenuPanel">
						</div>
					</div>
				</div> `,
			{
				x: 0,
				y: 0,
				w: 2,
				h: 2,
			}
		);

		this.installPlugin('MenuPanel', `#panel-MenuPanel`, styleSystem);

		this.numberPanelIncrement = 0;
		this.eventSystem.createActionByCallback('changeMode', guid, this.changeMode.bind(this));
		this.eventSystem.createActionByCallback('defaultAddPanel', guid, this.defaultAddPanel.bind(this));
		this.eventSystem.createActionByCallback('compactAllPanels', guid, this.compactAllPanels.bind(this));
	}

	createWorkspaceCell(x = null, y = null, w = null, h = null) {
		//TODO: Prettify next assignments
		x = Number.isInteger(x) ? x : this.addingOptions.x;
		y = Number.isInteger(y) ? y : this.addingOptions.y;
		w = Number.isInteger(w) ? w : this.addingOptions.w;
		h = Number.isInteger(h) ? h : this.addingOptions.h;

		let guidOfPanelInCell;
		const currentNumberPanel = new Number(this.numberPanelIncrement);

		// TODO: Replace on WEB-COMPONENT with style!
		this.grid.addWidget(
			`
			<div class="grid-stack-item">
        <div class="grid-stack-item-content">
          <div class="handle-drag-of-panel gridstack-panel-header" style="display:${this.editMode ? 'flex' : 'hide'}">
            <div id="closePanelBtn-${currentNumberPanel}" class="close-panel-button">
              <i  class="fas fa-lg fa-times"></i>
            </div>
          </div>
          <div class="gridstack-content-container${this.editMode ? ' gridstack-panel-overlay' : ''}">
            <div id="panel-${currentNumberPanel}">
            </div>
          <div>
				</div>
			</div>
		`,
			{x, y, w, h, id: currentNumberPanel}
		);

		const selectEl = document.createElement('select');
		selectEl.classList = 'default-select-panel';
		selectEl.options[0] = new Option('Выбрать панель ↓');
		let nextOptionIndex = 1;
		this.getPanels().forEach(plug => {
			const {type, title, name} = plug;
			if (type === 'panel' && name !== 'MenuPanel') {
				selectEl.options[nextOptionIndex] = new Option(title, name);
				nextOptionIndex++;
			}
		});

		selectEl.onchange = evt => {
			const idCell = evt.target.parentElement.getAttribute('id');
			const workspaceCellID = idCell.split('-').pop();

			// nextline for removing guid from systemGUID
			guidOfPanelInCell = this.mountWorkspacePanel(workspaceCellID, this.pluginRegistrator.getPlugin(selectEl.value));
		};

		document.getElementById(`panel-${currentNumberPanel}`).appendChild(selectEl);

		// closePanelBtn
		document.getElementById(`closePanelBtn-${currentNumberPanel}`).addEventListener('click', evt => {
			console.log(evt);
			const el = document.querySelector(`[gs-id="${currentNumberPanel}"]`);
			this.grid.removeWidget(el);
			this.systemGUID.removeGUID(guidOfPanelInCell);
		});

		this.numberPanelIncrement++;

		return currentNumberPanel;
	}

	mountWorkspacePanel(workspaceCellID, plugin) {
		const selector = `#panel-${workspaceCellID}`; // TODO: ADD PREFIX AFTER
		const guid = this.pluginRegistrator.installPanel(selector, plugin);
		return guid;
	}

	// Public actions

	defaultAddPanel(msg) {
		this.createWorkspaceCell();
	}

	_mountPanelForDevelop(name, x = null, y = null, w = null, h = null) {
		const numberPanel = this.createWorkspaceCell(x, y, w, h);
		this.mountWorkspacePanel(numberPanel, this.pluginRegistrator.getPlugin(name));
	}

	compactAllPanels() {
		this.grid.compact();
	}
	changeMode() {
		const panelHeaders = document.querySelectorAll('.gridstack-panel-header');
		panelHeaders.forEach(header => {
			header.style.display = this.editMode ? 'none' : 'flex';
		});
		const panelContents = document.querySelectorAll('.gridstack-content-container');

		const overlayClass = 'gridstack-panel-overlay';
		panelContents.forEach(content => {
			this.editMode ? content.classList.remove(overlayClass) : content.classList.add(overlayClass);
		});

		const margin = this.editMode ? '0px' : '10px';
		this.grid.batchUpdate();
		this.grid.margin(margin);
		this.grid.commit();
		this.grid.setStatic(this.editMode);
		this.editMode = !this.editMode;
	}
}
