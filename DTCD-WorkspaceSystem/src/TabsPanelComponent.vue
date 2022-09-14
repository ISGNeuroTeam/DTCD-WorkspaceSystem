<template>
  <div
    v-if="visible"
    ref="tabPanel"
    class="NavPanel"
  >
    <button
      v-show="scrollButton"
      class="ScrollBtn type_prev type_prev-js"
      :class="{withScroll: scrollButton}"
      @click="scroll(false)"
    >
      <span class="FontIcon name_chevronDuoDown size_lg rotate_90"/>
    </button>

    <div class="TabBtnsListWrapper TabBtnsListWrapper-js">
      <draggable
        v-if="tabList.length"
        v-model="tabsCollection"
        ref="tabList"
        :disabled="edit"
        groop="tabs"
        class="TabBtnsList TabBtnsList-js"
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
          @click="setActiveTab(id)"
        >
          <span class="TabName TabName-js">{{ name }}</span>

          <button class="BtnLayer BtnLayer-js" type="button"></button>

          <base-input
            :value="tabName"
            class="InputField InputField-js"
            :style="{border: invalid ? '1px solid red' : ''}"
            ref="input"
            size="small"
            @input="tabName = $event.target.value"
            @focus="invalid = false"
          ></base-input>

          <button
            class="BtnIcon type_edit type_edit-js"
            type="button"
            title="Редактировать название вкладки"
            @click="changeName(index, name)"
          >
            <span class="FontIcon name_edit"/>
          </button>
          <button
            class="BtnIcon type_check type_check-js"
            type="button"
            title="Сохранить название вкладки"
            @click="saveName(index)"
          >
            <span class="FontIcon name_checkBig"/>
          </button>
          <button
            class="BtnIcon type_delete type_delete-js"
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
      type="button"
      class="AddBtn-js"
      title="Добавить новую вкладку"
      @click="addNewTab"
    >
      <span class="FontIcon name_closeBig rotate_45 size_lg"/>
    </button>

    <button
      v-show="scrollButton"
      class="ScrollBtn type_next type_next-js"
      :class="{
        withScroll: scrollButton,
      }"
      @click="scroll(true)"
    >
      <span class="FontIcon name_chevronDuoDown size_lg rotate_270"/>
    </button>
  </div>
</template>

<script>
import draggable from 'vuedraggable';
export default {
  name: "TabsSwtcherComponent",
  components: {
    draggable,
  },
  data: ({$root}) => {
    return {
      tabsCollection: $root.tabsCollection,
      editMode: $root.editMode,
      visibleNavBar: $root.visibleNavBar,
      tabsSwitcherInstance: $root.tabsSwitcherInstance,
      tabName: '',
      scrollButton: false,
      invalid: false,
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
        const { scrollWidth } = this.$refs.tabList.$el;
        const { clientWidth } = this.$refs.tabPanel;
        this.scrollButton = clientWidth - 100 < scrollWidth;
      }
      return tabId;
    },
    setActiveTab(tabId) {
      this.tabsCollection.forEach((tab) => {
        tab.isActive = tab.id === tabId;
      });
      this.tabsSwitcherInstance.activeTab(tabId);
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
        this.invalid = true;
        return;
      }
      this.tabsCollection[index].editName = false;
      this.tabsCollection[index].name = this.tabName;
    },
    scroll(toRight) {
      this.$refs.tabList.$el.scrollLeft += toRight
        ? (this.$refs.tabPanel.clientWidth * 0.8)
        : -(this.$refs.tabPanel.clientWidth * 0.8);
    },
  },
}
</script>

<style scoped lang="scss">
@import 'styles/TabBtn.scss';
@import 'styles/TabsSwitcher.scss';
</style>