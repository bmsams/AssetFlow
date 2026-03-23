#!/usr/bin/env node
/* eslint-disable no-console */

const { runContractCheck } = require('./model-contract-check-common');

runContractCheck('docs/contracts/report-shared-contract.json', 'report-model-contract');

