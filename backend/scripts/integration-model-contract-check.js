#!/usr/bin/env node
/* eslint-disable no-console */

const { runContractCheck } = require('./model-contract-check-common');

runContractCheck('docs/contracts/integration-shared-contract.json', 'integration-model-contract');

