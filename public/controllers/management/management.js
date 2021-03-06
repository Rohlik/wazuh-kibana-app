/*
 * Wazuh app - Management controller
 * Copyright (C) 2018 Wazuh, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Find more information about this on the LICENSE file.
 */
import { TabNames } from '../../utils/tab-names';

export class ManagementController {
  constructor($scope, $location, shareAgent) {
    this.$scope = $scope;
    this.$location = $location;
    this.shareAgent = shareAgent;
    this.tab = 'welcome';
    this.rulesetTab = 'rules';
    this.tabNames = TabNames;
    this.wazuhManagementTabs = ['ruleset', 'groups'];
    this.statusReportsTabs = ['status', 'logs', 'reporting', 'monitoring'];
  }

  $onInit() {
    if (this.shareAgent.getAgent() && this.shareAgent.getSelectedGroup()) {
      this.tab = 'groups';
      this.switchTab(this.tab);
      return;
    }
    const location = this.$location.search();
    if (location && location.tab) {
      this.tab = location.tab;
      this.switchTab(this.tab);
    }
  }

  inArray(item, array) {
    return item && Array.isArray(array) && array.includes(item);
  }

  switchTab(tab) {
    this.tab = tab;

    if (this.tab === 'groups') {
      this.$scope.$broadcast('groupsIsReloaded');
    }

    if (this.tab === 'ruleset') {
      this.$scope.$broadcast('rulesetIsReloaded');
      this.globalRuleSet = 'ruleset';
      this.globalRulesetTab = this.rulesetTab;
    } else {
      this.globalRuleSet = false;
      this.globalRulesetTab = false;
    }

    this.$location.search('tab', this.tab);
  }

  setRulesTab(tab) {
    this.rulesetTab = tab;
    this.globalRulesetTab = this.rulesetTab;
  }
}
