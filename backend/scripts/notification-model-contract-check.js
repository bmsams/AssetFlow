#!/usr/bin/env node
/* eslint-disable no-console */

const { runContractCheck } = require('./model-contract-check-common');

runContractCheck('docs/contracts/notification-shared-contract.json', 'notification-model-contract');

