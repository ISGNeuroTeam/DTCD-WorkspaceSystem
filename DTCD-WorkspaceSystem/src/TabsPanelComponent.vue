<template>
  <div
    v-if="visible"
    ref="tabPanel"
    class="NavPanel"
  >
    <button
      v-show="scrollButton"
      class="ScrollBtn type_prev"
      :disabled="scrollLeft === 0"
      @click="scroll(false)"
    >
      <span class="FontIcon name_chevronDuoDown size_lg rotate_90"/>
    </button>

    <div
      ref="tabList"
      class="TabBtnsListWrapper"
    >
      <draggable
        v-if="tabList.length"
        v-model="tabsCollection"
        :disabled="!edit"
        groop="tabs"
        class="TabBtnsList"
      >
        <div
          v-for="({id, name, isActive, editName}, index) in tabList"
          :key="id"
          :data-tab-id="id"
          class="TabBtn"
          :class="{
            status_active: isActive,
            status_editOn: edit,
            status_editName: editName
          }"
          @click="tabClickHandler(id)"
        >
          <span class="TabName">{{ name | truncate( 21, '...') }}</span>

          <button class="BtnLayer" type="button"></button>

          <base-input
            :value="tabName"
            class="InputField"
            ref="input"
            size="small"
            @input="tabName = $event.target.value"
            @focus="resetError(index)"
            maxlength="21"
          ></base-input>

          <button
            class="BtnIcon type_edit"
            type="button"
            title="Редактировать название вкладки"
            @click="changeName(index, name)"
          >
            <span class="FontIcon name_edit"/>
          </button>
          <button
            class="BtnIcon type_check"
            type="button"
            title="Сохранить название вкладки"
            @click="saveName(index)"
          >
            <span class="FontIcon name_checkBig"/>
          </button>
          <button
            class="BtnIcon type_delete"
            type="button"
            title="Удалить вкладку"
            @click.stop="removeTab(id, index)"
          >
            <span class="FontIcon name_closeBig"/>
          </button>
        </div>
      </draggable>
    </div>

    <button
      v-show="edit"
      type="button"
      class="AddBtn"
      title="Добавить новую вкладку"
      @click="addNewTab"
    >
      <span class="FontIcon name_closeBig rotate_45 size_lg"/>
    </button>

    <button
      v-show="scrollButton"
      class="ScrollBtn type_next"
      :disabled="(clientWidth + scrollLeft) > scrollWidth"
      @click="scroll(true)"
    >
      <span class="FontIcon name_chevronDuoDown size_lg rotate_270"/>
    </button>
  </div>
</template>

<script>
import draggable from 'vuedraggable';
export default {
  name: "TabsPanelComponent",
  components: {
    draggable,
  },
  data: ({$root}) => {
    return {
      tabsCollection: $root.tabsCollection,
      editMode: $root.editMode,
      visibleNavBar: $root.visibleNavBar,
      tabsSwitcherInstance: $root.tabsSwitcherInstance,
      logSystem: $root.logSystem,
      eventSystem: $root.eventSystem,
      currentTab: '',
      tabName: '',
      scrollButton: false,
      scrollWidth: null,
      clientWidth: null,
      scrollLeft: null,
    }
  },
  computed: {
    tabList: {
      get () {
        return this.tabsCollection;
      },
      set (val) {
        this.tabsCollection.push(val);
      }
    },
    edit() {
      return this.editMode;
    },
    visible() {
      return this.visibleNavBar;
    },
    getConfig () {
      const config = {
        editMode: this.edit,
        visibleNavBar: this.visible,
        tabsOptions: this.tabList,
      };

      return config;
    },
  },
  updated() {
    if (this.$refs && this.$refs.tabList) {
      this.clientWidth = this.$refs.tabPanel.clientWidth;
      this.scrollWidth = this.$refs.tabList.scrollWidth;
      this.scrollLeft = this.$refs.tabList.scrollLeft;
      this.scrollButton = this.clientWidth < this.scrollWidth;
    }
  },
  methods: {
    addNewTab(tabOptions) {
      const {
        id,
        name,
      } = tabOptions instanceof Object ? tabOptions : {};

      const tabId = id ? id : this.getIdNewTab();

      this.tabList = ({
        id: tabId,
        name: name ? name : tabId,
        isActive: false,
        editName: false,
      });

      this.tabsSwitcherInstance.addNewTab(tabId, this.tabsCollection);
      if (this.$refs.tabPanel) {
        this.scrollButton = this.clientWidth < this.scrollWidth;
      }
      return tabId;
    },

    tabClickHandler(id) {
      const clickedTab = this.getTab(id);

      this.eventSystem.publishEvent('WorkspaceTabClicked', clickedTab);
      this.logSystem.debug(`Clicked "${id}" workspace tab`);

      if (id !== this.currentTab) this.setActiveTab(id);
    },

    setActiveTab(tabId) {
      this.tabsCollection.forEach((tab) => {
        tab.isActive = tab.id === tabId;
      });
      this.tabsSwitcherInstance.activeTab(tabId);
      this.currentTab = tabId;
      this.logSystem.debug(`Activated "${tabId}" workspace tab`);
    },

    removeTab(tabId, index) {
      if (!tabId || this.tabsCollection.length === 1) {
        return;
      }
      const deletedTabIsActive = this.tabsCollection[index].isActive;
      this.tabsSwitcherInstance.removeTab(tabId);
      this.tabsCollection.splice(index, 1);

      if (deletedTabIsActive) {
        this.setActiveTab(this.tabsCollection[0].id)
      }

    },

    getTab(tabId) {
      if (!tabId) {
        return;
      }
      return this.tabsCollection.find((tab) => tab.id === tabId);
    },

    getIdNewTab() {
      return `wss-tab-${Math.ceil(Math.random() * 10000)}`;
    },

    changeName(index, name) {
      this.tabsCollection[index].editName = true;
      this.tabName = name;
    },

    saveName(index) {
      const checkTabName = this.tabsCollection.find((tab, i) => tab.name === this.tabName && i !== index);
      if (checkTabName) {
        this.$refs.input[index].invalid = true;
        return;
      }
      this.tabsCollection[index].editName = false;
      this.tabsCollection[index].name = this.tabName;
    },

    resetError(index) {
      this.$refs.input[index].invalid = false;
    },

    scroll(toRight) {
      this.$refs.tabList.scrollLeft += toRight
          ? (this.$refs.tabPanel.clientWidth * 0.8)
          : -(this.$refs.tabPanel.clientWidth * 0.8);
      this.scrollWidth = this.$refs.tabList.scrollWidth;
      this.scrollLeft = this.$refs.tabList.scrollLeft;
      this.clientWidth = this.$refs.tabPanel.clientWidth;
    },
  },
  filters: {
    truncate: function (text, length, suffix) {
      if (text.length > length) {
        return text.substring(0, length) + suffix;
      } else {
        return text;
      }
    },
  },
}
</script>

<style scoped lang="scss">
@import 'styles/TabBtn.scss';
@import 'styles/TabsSwitcher.scss';
</style>
