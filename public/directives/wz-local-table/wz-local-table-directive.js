/*
 * Wazuh app - Wazuh local table directive
 * Copyright (C) 2018 Wazuh, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Find more information about this on the LICENSE file.
 */

import template from './wz-local-table.html';
import { uiModules } from 'ui/modules';
import { KeyEquivalenece } from '../../../util/csv-key-equivalence';
import { calcTableRows } from './lib/rows';
import { parseValue } from './lib/parse-value';
import * as pagination from './lib/pagination';

const app = uiModules.get('app/wazuh', []);

app.directive('wzLocalTable', function() {
  return {
    restrict: 'E',
    scope: {
      keys: '=keys',
      rowSizes: '=rowSizes',
      extraLimit: '=extraLimit',
      items: '=items'
    },
    controller(
      $scope,
      $window
    ) {

      /**
       * Init variables
       */
      $scope.keyEquivalence = KeyEquivalenece;
      $scope.totalItems = $scope.items.length;

      /**
       * Resizing. Calculate number of table rows depending on the screen height
       */
      const rowSizes = $scope.rowSizes || [15, 13, 11];
      let doit;
      $window.onresize = () => {
        clearTimeout(doit);
        doit = setTimeout(() => {
          $scope.rowsPerPage = calcTableRows($window.innerHeight, rowSizes);
          $scope.itemsPerPage = $scope.rowsPerPage;
        }, 150);
      };
      $scope.rowsPerPage = calcTableRows($window.innerHeight, rowSizes);

      $scope.parseValue = (key, item) => parseValue(key, item);

      /**
       * Pagination variables and functions
       */
      $scope.itemsPerPage = $scope.rowsPerPage || 10;
      $scope.pagedItems = [];
      $scope.currentPage = 0;
      $scope.gap = 0;
      $scope.searchTable = () => pagination.searchTable($scope, $scope.items);
      $scope.groupToPages = () => pagination.groupToPages($scope);
      $scope.range = (size, start, end) =>
        pagination.range(size, start, end, $scope.gap);
      $scope.prevPage = () => pagination.prevPage($scope);
      $scope.nextPage = async currentPage =>
        pagination.nextPage(currentPage, $scope);
      $scope.setPage = function() {
        $scope.currentPage = this.n;
        $scope.nextPage(this.n);
      };

      const gap = $scope.items.length / $scope.itemsPerPage;
      const gapInteger = parseInt(gap);
      $scope.gap = gap - gapInteger > 0 ? gapInteger + 1 : gapInteger;
      if ($scope.gap > 5) $scope.gap = 5;
      pagination.searchTable($scope, $scope.items)
      $scope.$on('$destroy', () => {
        $window.onresize = null;
      });
    },
    template
  };
});
