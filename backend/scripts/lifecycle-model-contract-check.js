#!/usr/bin/env node
/* eslint-disable no-console */

const { runContractCheck } = require('./model-contract-check-common');

runContractCheck('docs/contracts/lifecycle-shared-contract.json', 'lifecycle-model-contract');

