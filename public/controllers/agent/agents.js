/*
 * Wazuh app - Agents controller
 * Copyright (C) 2018 Wazuh, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Find more information about this on the LICENSE file.
 */
import { FilterHandler } from '../../utils/filter-handler';
import { generateMetric } from '../../utils/generate-metric';
import { TabNames } from '../../utils/tab-names';
import * as FileSaver from '../../services/file-saver';
import { TabDescription } from '../../../server/reporting/tab-description';

import {
  metricsAudit,
  metricsVulnerability,
  metricsScap,
  metricsCiscat,
  metricsVirustotal
} from '../../utils/agents-metrics';

import { ConfigurationHandler } from '../../utils/config-handler';
import { timefilter } from 'ui/timefilter';

export class AgentsController {
  constructor(
    $scope,
    $location,
    $rootScope,
    appState,
    apiReq,
    errorHandler,
    tabVisualizations,
    shareAgent,
    commonData,
    reportingService,
    visFactoryService,
    csvReq,
    wzTableFilter
  ) {
    this.$scope = $scope;
    this.$location = $location;
    this.$rootScope = $rootScope;
    this.appState = appState;
    this.apiReq = apiReq;
    this.errorHandler = errorHandler;
    this.tabVisualizations = tabVisualizations;
    this.shareAgent = shareAgent;
    this.commonData = commonData;
    this.reportingService = reportingService;
    this.visFactoryService = visFactoryService;
    this.csvReq = csvReq;
    this.wzTableFilter = wzTableFilter;

    // Config on-demand
    this.$scope.isArray = Array.isArray;
    this.configurationHandler = new ConfigurationHandler(apiReq, errorHandler);
    this.$scope.currentConfig = null;
    this.$scope.configurationTab = '';
    this.$scope.configurationSubTab = '';
    this.$scope.integrations = {};
    this.$scope.selectedItem = 0;
    this.targetLocation = null;
    this.ignoredTabs = ['syscollector', 'welcome', 'configuration'];
  }

  $onInit() {
    this.$scope.TabDescription = TabDescription;

    this.$rootScope.reportStatus = false;

    this.$location.search('_a', null);
    this.filterHandler = new FilterHandler(this.appState.getCurrentPattern());
    this.visFactoryService.clearAll();

    const currentApi = JSON.parse(this.appState.getCurrentAPI()).id;
    const extensions = this.appState.getExtensions(currentApi);
    this.$scope.extensions = extensions;

    // Getting possible target location
    this.targetLocation = this.shareAgent.getTargetLocation();

    if (this.targetLocation && typeof this.targetLocation === 'object') {
      this.$scope.tabView = this.targetLocation.subTab;
      this.$scope.tab = this.targetLocation.tab;
    } else {
      this.$scope.tabView = this.commonData.checkTabViewLocation();
      this.$scope.tab = this.commonData.checkTabLocation();
    }

    this.tabHistory = [];
    if (!this.ignoredTabs.includes(this.$scope.tab))
      this.tabHistory.push(this.$scope.tab);

    // Tab names
    this.$scope.tabNames = TabNames;

    this.tabVisualizations.assign('agents');

    this.$scope.hostMonitoringTabs = ['general', 'fim', 'syscollector'];
    this.$scope.systemAuditTabs = ['pm', 'audit', 'oscap', 'ciscat'];
    this.$scope.securityTabs = ['vuls', 'virustotal', 'osquery'];
    this.$scope.complianceTabs = ['pci', 'gdpr'];

    this.$scope.inArray = (item, array) =>
      item && Array.isArray(array) && array.includes(item);

    this.$scope.switchSubtab = async (
      subtab,
      force = false,
      onlyAgent = false,
      sameTab = true,
      preserveDiscover = false
    ) => this.switchSubtab(subtab, force, onlyAgent, sameTab, preserveDiscover);

    this.changeAgent = false;

    this.$scope.switchTab = (tab, force = false) => this.switchTab(tab, force);

    this.$scope.getAgentStatusClass = agentStatus =>
      agentStatus === 'Active' ? 'teal' : 'red';

    this.$scope.formatAgentStatus = agentStatus => {
      return ['Active', 'Disconnected'].includes(agentStatus)
        ? agentStatus
        : 'Never connected';
    };
    this.$scope.getAgent = async newAgentId => this.getAgent(newAgentId);
    this.$scope.goGroups = (agent, group) => this.goGroups(agent, group);
    this.$scope.analyzeAgents = async searchTerm =>
      this.analyzeAgents(searchTerm);
    this.$scope.downloadCsv = async data_path => this.downloadCsv(data_path);

    this.$scope.search = (term, specificPath) =>
      this.$scope.$broadcast('wazuhSearch', { term, specificPath });

    this.$scope.startVis2Png = () => this.startVis2Png();

    this.$scope.$on('$destroy', () => {
      this.visFactoryService.clearAll();
    });

    this.$scope.isArray = Array.isArray;

    this.$scope.goGroup = () => {
      this.shareAgent.setAgent(this.$scope.agent);
      this.$location.path('/manager/groups');
    };

    //Load
    try {
      this.$scope.getAgent();
    } catch (e) {
      this.errorHandler.handle(
        'Unexpected exception loading controller',
        'Agents'
      );
    }

    // Config on demand
    this.$scope.getXML = () => this.configurationHandler.getXML(this.$scope);
    this.$scope.getJSON = () => this.configurationHandler.getJSON(this.$scope);
    this.$scope.isString = item => typeof item === 'string';
    this.$scope.hasSize = obj =>
      obj && typeof obj === 'object' && Object.keys(obj).length;
    this.$scope.switchConfigTab = (configurationTab, sections, navigate = true) => {
      this.$scope.navigate = navigate;
      try {
        this.$scope.configSubTab = JSON.stringify({ 'configurationTab': configurationTab, 'sections': sections });
        if (!this.$location.search().configSubTab) {
          this.appState.setSessionStorageItem('configSubTab', this.$scope.configSubTab);
          this.$location.search('configSubTab', true);
        }
      } catch (error) {
        this.errorHandler.handle(error, 'Set configuration path');
      }
      this.configurationHandler.switchConfigTab(
        configurationTab,
        sections,
        this.$scope,
        this.$scope.agent.id
      );
    }
    this.$scope.switchWodle = (wodleName, navigate = true) => {
      this.$scope.navigate = navigate;
      this.$scope.configWodle = wodleName;
      if (!this.$location.search().configWodle) {
        this.$location.search('configWodle', this.$scope.configWodle);
      }
      this.configurationHandler.switchWodle(
        wodleName,
        this.$scope,
        this.$scope.agent.id
      )
    };
    this.$scope.switchConfigurationTab = (configurationTab, navigate) => {
      this.$scope.navigate = navigate;
      this.configurationHandler.switchConfigurationTab(
        configurationTab,
        this.$scope
      );
      if (!this.$scope.navigate) {
        const configSubTab = this.$location.search().configSubTab;
        if (configSubTab) {
          try {
            const config = this.appState.getSessionStorageItem('configSubTab');
            const configSubTabObj = JSON.parse(config);
            this.$scope.switchConfigTab(configSubTabObj.configurationTab, configSubTabObj.sections, false);
          } catch (error) {
            this.errorHandler.handle(error, 'Get configuration path');
          }
        } else {
          const configWodle = this.$location.search().configWodle;
          if (configWodle) {
            this.$scope.switchWodle(configWodle, false);
          }
        }
      } else {
        this.$location.search('configSubTab', null);
        this.appState.removeSessionStorageItem('configSubTab');
        this.$location.search('configWodle', null);
      }
    }
    this.$scope.switchConfigurationSubTab = configurationSubTab => {
      this.configurationHandler.switchConfigurationSubTab(
        configurationSubTab,
        this.$scope
      );
    }
    this.$scope.updateSelectedItem = i => (this.$scope.selectedItem = i);
    this.$scope.getIntegration = list =>
      this.configurationHandler.getIntegration(list, this.$scope);

    this.$scope.$on('$routeChangeStart', () => this.appState.removeSessionStorageItem('configSubTab'));
  }

  createMetrics(metricsObject) {
    for (let key in metricsObject) {
      this.$scope[key] = () => generateMetric(metricsObject[key]);
    }
  }

  checkMetrics(tab, subtab) {
    if (subtab === 'panels') {
      switch (tab) {
        case 'audit':
          this.createMetrics(metricsAudit);
          break;
        case 'vuls':
          this.createMetrics(metricsVulnerability);
          break;
        case 'oscap':
          this.createMetrics(metricsScap);
          break;
        case 'ciscat':
          this.createMetrics(metricsCiscat);
          break;
        case 'virustotal':
          this.createMetrics(metricsVirustotal);
          break;
      }
    }
  }

  // Switch subtab
  async switchSubtab(
    subtab,
    force = false,
    onlyAgent = false,
    sameTab = true,
    preserveDiscover = false
  ) {
    try {
      if (this.$scope.tabView === subtab && !force) return;

      this.visFactoryService.clear(onlyAgent);
      this.$location.search('tabView', subtab);
      const localChange =
        subtab === 'panels' && this.$scope.tabView === 'discover' && sameTab;
      this.$scope.tabView = subtab;

      if (
        (subtab === 'panels' ||
          (this.targetLocation &&
            typeof this.targetLocation === 'object' &&
            this.targetLocation.subTab === 'discover' &&
            subtab === 'discover')) &&
        !this.ignoredTabs.includes(this.$scope.tab)
      ) {
        const condition =
          !this.changeAgent && (localChange || preserveDiscover);

        await this.visFactoryService.buildAgentsVisualizations(
          this.filterHandler,
          this.$scope.tab,
          subtab,
          condition,
          this.$scope.agent.id
        );

        this.changeAgent = false;
      } else {
        this.$rootScope.$emit('changeTabView', {
          tabView: this.$scope.tabView
        });
      }

      this.checkMetrics(this.$scope.tab, subtab);

      return;
    } catch (error) {
      this.errorHandler.handle(error, 'Agents');
      return;
    }
  }

  // Switch tab
  async switchTab(tab, force = false) {
    if (this.ignoredTabs.includes(tab)) {
      const timeFilterRefreshStatus = timefilter.getRefreshInterval();
      const toggle =
        timeFilterRefreshStatus &&
        timeFilterRefreshStatus.value &&
        !timeFilterRefreshStatus.pause;
      if (toggle) timefilter.toggleRefresh();
    }

    try {
      if (tab === 'pci') {
        const pciTabs = await this.commonData.getPCI();
        this.$scope.pciTabs = pciTabs;
        this.$scope.selectedPciIndex = 0;
      }
      if (tab === 'gdpr') {
        const gdprTabs = await this.commonData.getPCI();
        this.$scope.gdprTabs = gdprTabs;
        this.$scope.selectedGdprIndex = 0;
      }
      if (tab === 'syscollector')
        await this.loadSyscollector(this.$scope.agent.id);
      if (tab === 'configuration') {
        const isSync = await this.apiReq.request(
          'GET',
          `/agents/${this.$scope.agent.id}/group/is_sync`,
          {}
        );
        // Configuration synced
        this.$scope.isSynchronized =
          isSync && isSync.data && isSync.data.data && isSync.data.data.synced;
        this.$scope.switchConfigurationTab('welcome');
      } else {
        this.configurationHandler.reset(this.$scope);
      }
      if (!this.ignoredTabs.includes(tab)) this.tabHistory.push(tab);
      if (this.tabHistory.length > 2)
        this.tabHistory = this.tabHistory.slice(-2);
      this.tabVisualizations.setTab(tab);
      if (this.$scope.tab === tab && !force) return;
      const onlyAgent = this.$scope.tab === tab && force;
      const sameTab = this.$scope.tab === tab;
      this.$location.search('tab', tab);
      const preserveDiscover =
        this.tabHistory.length === 2 &&
        this.tabHistory[0] === this.tabHistory[1] &&
        !force;
      this.$scope.tab = tab;

      const targetSubTab =
        this.targetLocation && typeof this.targetLocation === 'object'
          ? this.targetLocation.subTab
          : 'panels';

      if (!this.ignoredTabs.includes(this.$scope.tab)) {
        this.$scope.switchSubtab(
          targetSubTab,
          true,
          onlyAgent,
          sameTab,
          preserveDiscover
        );
      }

      this.shareAgent.deleteTargetLocation();
      this.targetLocation = null;
    } catch (error) {
      return Promise.reject(error);
    }
    if (!this.$scope.$$phase) this.$scope.$digest();
  }

  // Agent data

  validateRootCheck() {
    const result = this.commonData.validateRange(this.$scope.agent.rootcheck);
    this.$scope.agent.rootcheck = result;
  }

  validateSysCheck() {
    const result = this.commonData.validateRange(this.$scope.agent.syscheck);
    this.$scope.agent.syscheck = result;
  }

  async loadSyscollector(id) {
    try {
      // Check that Syscollector is enabled before proceeding
      this.$scope.syscollectorEnabled = await this.configurationHandler.isWodleEnabled(
        'syscollector',
        id
      );

      // If Syscollector is disabled, stop loading
      if (!this.$scope.syscollectorEnabled) {
        return;
      }

      // Continue API requests if we do have Syscollector enabled
      // Fetch Syscollector data
      const data = await Promise.all([
        this.apiReq.request('GET', `/syscollector/${id}/hardware`, {}),
        this.apiReq.request('GET', `/syscollector/${id}/os`, {}),
        this.apiReq.request('GET', `/syscollector/${id}/netiface`, {}),
        this.apiReq.request('GET', `/syscollector/${id}/ports`, {}),
        this.apiReq.request('GET', `/syscollector/${id}/packages`, {
          limit: 1,
          select: 'scan_time'
        }),
        this.apiReq.request('GET', `/syscollector/${id}/processes`, {
          limit: 1,
          select: 'scan_time'
        })
      ]);

      const result = data.map(
        item => (item && item.data && item.data.data ? item.data.data : false)
      );
      const [
        hardwareResponse,
        osResponse,
        netifaceResponse,
        portsResponse,
        packagesDateResponse,
        processesDateResponse
      ] = result;

      // Before proceeding, syscollector data is an empty object
      this.$scope.syscollector = {};

      const packagesDate = packagesDateResponse
        ? { ...packagesDateResponse }
        : false;
      const processesDate = processesDateResponse
        ? { ...processesDateResponse }
        : false;

      // Fill syscollector object
      this.$scope.syscollector = {
        hardware:
          typeof hardwareResponse === 'object' &&
            Object.keys(hardwareResponse).length
            ? { ...hardwareResponse }
            : false,
        os:
          typeof osResponse === 'object' && Object.keys(osResponse).length
            ? { ...osResponse }
            : false,
        netiface: netifaceResponse ? { ...netifaceResponse } : false,
        ports: portsResponse ? { ...portsResponse } : false,
        packagesDate:
          packagesDate && packagesDate.items && packagesDate.items.length
            ? packagesDate.items[0].scan_time
            : 'Unknown',
        processesDate:
          processesDate && processesDate.items && processesDate.items.length
            ? processesDate.items[0].scan_time
            : 'Unknown'
      };

      return;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async getAgent(newAgentId) {
    try {
      this.$scope.isSynchronized = false;
      this.$scope.load = true;
      this.changeAgent = true;

      const globalAgent = this.shareAgent.getAgent();

      const id = this.commonData.checkLocationAgentId(newAgentId, globalAgent);

      const data = await Promise.all([
        this.apiReq.request('GET', `/agents/${id}`, {}),
        this.apiReq.request('GET', `/syscheck/${id}/last_scan`, {}),
        this.apiReq.request('GET', `/rootcheck/${id}/last_scan`, {})
      ]);

      const result = data.map(
        item => (item && item.data && item.data.data ? item.data.data : false)
      );

      const [agentInfo, syscheckLastScan, rootcheckLastScan] = result;

      // Agent
      this.$scope.agent = agentInfo;
      if (this.$scope.agent.os) {
        this.$scope.agentOS =
          this.$scope.agent.os.name + ' ' + this.$scope.agent.os.version;
      } else {
        this.$scope.agentOS = 'Unknown';
      }

      // Syscheck
      this.$scope.agent.syscheck = syscheckLastScan;
      this.validateSysCheck();

      // Rootcheck
      this.$scope.agent.rootcheck = rootcheckLastScan;
      this.validateRootCheck();

      await this.$scope.switchTab(this.$scope.tab, true);

      this.$scope.load = false;
      if (!this.$scope.$$phase) this.$scope.$digest();
      return;
    } catch (error) {
      this.errorHandler.handle(error, 'Agents');
    }
    return;
  }

  goGroups(agent, group) {
    this.visFactoryService.clearAll();
    this.shareAgent.setAgent(agent, group);
    this.$location.search('tab', 'groups');
    this.$location.path('/manager');
  }

  async analyzeAgents(searchTerm) {
    try {
      if (searchTerm) {
        const reqData = await this.apiReq.request('GET', '/agents', {
          search: searchTerm
        });
        return reqData.data.data.items.filter(item => item.id !== '000');
      } else {
        const reqData = await this.apiReq.request('GET', '/agents', {});
        return reqData.data.data.items.filter(item => item.id !== '000');
      }
    } catch (error) {
      this.errorHandler.handle(error, 'Agents');
    }
    return;
  }

  async downloadCsv(data_path) {
    try {
      this.errorHandler.info(
        'Your download should begin automatically...',
        'CSV'
      );
      const currentApi = JSON.parse(this.appState.getCurrentAPI()).id;
      const output = await this.csvReq.fetch(
        data_path,
        currentApi,
        this.wzTableFilter.get()
      );
      const blob = new Blob([output], { type: 'text/csv' }); // eslint-disable-line

      FileSaver.saveAs(blob, 'packages.csv');

      return;
    } catch (error) {
      this.errorHandler.handle(error, 'Download CSV');
    }
    return;
  }

  async firstLoad() {
    try {
      const globalAgent = this.shareAgent.getAgent();
      this.$scope.configurationError = false;
      this.$scope.load = true;

      const id = this.commonData.checkLocationAgentId(false, globalAgent);

      const data = await this.apiReq.request('GET', `/agents/${id}`, {});
      this.$scope.agent = data.data.data;
      this.$scope.groupName = this.$scope.agent.group;

      if (!this.$scope.groupName) {
        this.$scope.configurationError = true;
        this.$scope.load = false;
        if (!this.$scope.$$phase) this.$scope.$digest();
        return;
      }

      this.$scope.load = false;

      if (this.$scope.tab !== 'configuration')
        await this.$scope.switchTab(this.$scope.tab, true);

      if (!this.$scope.$$phase) this.$scope.$digest();
      return;
    } catch (error) {
      this.errorHandler.handle(error, 'Agents');
    }
    return;
  }
  /** End of agent configuration */

  startVis2Png() {
    const syscollectorFilters = [];
    if (
      this.$scope.tab === 'syscollector' &&
      this.$scope.agent &&
      this.$scope.agent.id
    ) {
      syscollectorFilters.push(
        this.filterHandler.managerQuery(
          this.appState.getClusterInfo().cluster,
          true
        )
      );
      syscollectorFilters.push(
        this.filterHandler.agentQuery(this.$scope.agent.id)
      );
    }
    this.reportingService.startVis2Png(
      this.$scope.tab,
      this.$scope.agent && this.$scope.agent.id ? this.$scope.agent.id : true,
      syscollectorFilters.length ? syscollectorFilters : null
    );
  }
}
