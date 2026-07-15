/** @Acp.Infra.Metrics — metric instruments and Prometheus rendering */
export {
  recordRpcCompletion,
  recordHttpCompletion,
  recordSweep,
  recordBuildInfo,
} from './instruments.js'
export {
  formatSnapshot,
  renderPrometheus,
  PROMETHEUS_CONTENT_TYPE,
} from './prometheus.js'
