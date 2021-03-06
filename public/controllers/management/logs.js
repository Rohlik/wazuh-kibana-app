/*
 * Wazuh app - Management logs controller
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

export class LogsController {
  constructor($scope, apiReq, errorHandler, csvReq, appState, wzTableFilter) {
    this.$scope = $scope;
    this.apiReq = apiReq;
    this.errorHandler = errorHandler;
    this.csvReq = csvReq;
    this.appState = appState;
    this.wzTableFilter = wzTableFilter;
    this.nodeList = false;
    this.type_log = 'all';
    this.category = 'all';
  }

  /**
   * Initialize
   */
  $onInit() {
    this.initialize();
  }

  /**
   * Event handler for the search bar.
   * @param {string} term Term(s) to be searched
   */
  search(term) {
    this.$scope.$broadcast('wazuhSearch', { term });
  }

  /**
   * Event handler for the selectors
   * @param {*} filter Filter to be applied
   */
  filter(filter) {
    this.$scope.$broadcast('wazuhFilter', { filter });
  }

  /**
   * Starts real time mode
   */
  playRealtime() {
    this.realtime = true;
    this.$scope.$broadcast('wazuhPlayRealTime');
  }

  /**
   * Stops real time mode
   */
  stopRealtime() {
    this.realtime = false;
    this.$scope.$broadcast('wazuhStopRealTime');
  }

  /**
   * Builds a CSV file from the table and starts the download
   */
  async downloadCsv() {
    try {
      this.errorHandler.info(
        'Your download should begin automatically...',
        'CSV'
      );
      const currentApi = JSON.parse(this.appState.getCurrentAPI()).id;
      const path = this.selectedNode
        ? `/cluster/${this.selectedNode}/logs`
        : '/manager/logs';
      const output = await this.csvReq.fetch(
        path,
        currentApi,
        this.wzTableFilter.get()
      );
      const blob = new Blob([output], { type: 'text/csv' }); // eslint-disable-line
      FileSaver.saveAs(blob, 'logs.csv');
      return;
    } catch (error) {
      this.errorHandler.handle(error, 'Download CSV');
    }
    return;
  }

  async changeNode(node) {
    try {
      this.type_log = 'all';
      this.category = 'all';
      this.selectedNode = node;
      this.$scope.$broadcast('wazuhUpdateInstancePath', {
        path: `/cluster/${node}/logs`
      });
      const summary = await this.apiReq.request(
        'GET',
        `/cluster/${node}/logs/summary`,
        {}
      );
      const daemons = summary.data.data;
      this.daemons = Object.keys(daemons).map(item => ({ title: item }));
      if (!this.$scope.$$phase) this.$scope.$digest();
    } catch (error) {
      this.errorHandler.handle(error, 'Logs');
    }
  }

  /**
   * Fetchs required data
   */
  async initialize() {
    try {
      const clusterStatus = await this.apiReq.request(
        'GET',
        '/cluster/status',
        {}
      );
      const clusterEnabled =
        clusterStatus &&
        clusterStatus.data &&
        clusterStatus.data.data &&
        clusterStatus.data.data.running === 'yes' &&
        clusterStatus.data.data.enabled === 'yes';

      if (clusterEnabled) {
        const nodeList = await this.apiReq.request('GET', '/cluster/nodes', {});
        if (
          nodeList &&
          nodeList.data &&
          nodeList.data.data &&
          Array.isArray(nodeList.data.data.items)
        ) {
          this.nodeList = nodeList.data.data.items
            .map(item => item.name)
            .reverse();
          this.selectedNode = nodeList.data.data.items.filter(
            item => item.type === 'master'
          )[0].name;
        }
      }

      this.logsPath = clusterEnabled
        ? `/cluster/${this.selectedNode}/logs`
        : '/manager/logs';

      const data = clusterEnabled
        ? await this.apiReq.request(
            'GET',
            `/cluster/${this.selectedNode}/logs/summary`,
            {}
          )
        : await this.apiReq.request('GET', '/manager/logs/summary', {});
      const daemons = data.data.data;
      this.daemons = Object.keys(daemons).map(item => ({ title: item }));
      if (!this.$scope.$$phase) this.$scope.$digest();
      return;
    } catch (error) {
      this.errorHandler.handle(error, 'Logs');
    }
    return;
  }
}
