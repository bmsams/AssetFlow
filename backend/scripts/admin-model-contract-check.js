#!/usr/bin/env node
/* eslint-disable no-console */

const { runContractCheck } = require('./model-contract-check-common');

runContractCheck('docs/contracts/admin-shared-contract.json', 'admin-model-contract');

