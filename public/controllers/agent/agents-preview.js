/*
 * Wazuh app - Agents preview controller
 * Copyright (C) 2018 Wazuh, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Find more information about this on the LICENSE file.
 */
import * as FileSaver from '../../services/file-saver';

export class AgentsPreviewController {
  constructor(
    $scope,
    genericReq,
    appState,
    $location,
    errorHandler,
    csvReq,
    shareAgent,
    wzTableFilter
  ) {
    this.$scope = $scope;
    this.genericReq = genericReq;
    this.appState = appState;
    this.$location = $location;
    this.errorHandler = errorHandler;
    this.csvReq = csvReq;
    this.shareAgent = shareAgent;
    this.wzTableFilter = wzTableFilter;
  }

  $onInit() {
    this.init = true;
    const loc = this.$location.search();
    if (loc && loc.agent && loc.agent !== '000')
      return this.showAgent({ id: loc.agent });

    this.isClusterEnabled =
      this.appState.getClusterInfo() &&
      this.appState.getClusterInfo().status === 'enabled';

    this.loading = true;
    this.status = 'all';
    this.osPlatform = 'all';
    this.version = 'all';
    this.osPlatforms = [];
    this.versions = [];
    this.groups = [];
    this.nodes = [];
    this.node_name = 'all';
    this.selectedGroup = 'all';
    this.mostActiveAgent = {
      name: '',
      id: ''
    };

    // Load URL params
    if (loc && loc.tab) {
      this.submenuNavItem = loc.tab;
    }

    // Watcher for URL params
    this.$scope.$watch('submenuNavItem', () => {
      this.$location.search('tab', this.submenuNavItem);
    });

    this.init = false;
    //Load
    this.load();
  }

  search(term) {
    this.$scope.$broadcast('wazuhSearch', { term });
  }

  filter(filter) {
    this.$scope.$broadcast('wazuhFilter', { filter });
  }

  showAgent(agent) {
    this.shareAgent.setAgent(agent);
    this.$location.path('/agents');
  }

  async downloadCsv() {
    try {
      this.errorHandler.info(
        'Your download should begin automatically...',
        'CSV'
      );
      const currentApi = JSON.parse(this.appState.getCurrentAPI()).id;
      const output = await this.csvReq.fetch(
        '/agents',
        currentApi,
        this.wzTableFilter.get()
      );
      const blob = new Blob([output], { type: 'text/csv' }); // eslint-disable-line

      FileSaver.saveAs(blob, 'agents.csv');

      return;
    } catch (error) {
      this.errorHandler.handle(error, 'Download CSV');
    }
    return;
  }

  async load() {
    try {
      const api = JSON.parse(this.appState.getCurrentAPI()).id;
      const clusterInfo = this.appState.getClusterInfo();
      const firstUrlParam =
        clusterInfo.status === 'enabled' ? 'cluster' : 'manager';
      const secondUrlParam = clusterInfo[firstUrlParam];

      const pattern = this.appState.getCurrentPattern();

      const data = await Promise.all([
        this.genericReq.request('GET', '/api/agents-unique/' + api, {}),
        this.genericReq.request(
          'GET',
          `/elastic/top/${firstUrlParam}/${secondUrlParam}/agent.name/${pattern}`
        )
      ]);
      const [agentsUnique, agentsTop] = data;
      const unique = agentsUnique.data.result;

      this.groups = unique.groups;
      this.nodes = unique.nodes.map(item => ({ id: item }));
      this.versions = unique.versions.map(item => ({ id: item }));
      this.osPlatforms = unique.osPlatforms;
      this.lastAgent = unique.lastAgent;
      this.agentsCountActive = unique.summary.agentsCountActive;
      this.agentsCountDisconnected = unique.summary.agentsCountDisconnected;
      this.agentsCountNeverConnected = unique.summary.agentsCountNeverConnected;
      this.agentsCountTotal = unique.summary.agentsCountTotal;
      this.agentsCoverity = unique.summary.agentsCoverity;

      if (agentsTop.data.data === '') {
        this.mostActiveAgent.name = this.appState.getClusterInfo().manager;
        this.mostActiveAgent.id = '000';
      } else {
        this.mostActiveAgent.name = agentsTop.data.data;
        const info = await this.genericReq.request(
          'GET',
          `/elastic/top/${firstUrlParam}/${secondUrlParam}/agent.id/${pattern}`
        );
        if (info.data.data === '' && this.mostActiveAgent.name !== '') {
          this.mostActiveAgent.id = '000';
        } else {
          this.mostActiveAgent.id = info.data.data;
        }
      }

      this.loading = false;
      if (!this.$scope.$$phase) this.$scope.$digest();
      return;
    } catch (error) {
      this.errorHandler.handle(error, 'Agents Preview');
    }
    return;
  }
}
