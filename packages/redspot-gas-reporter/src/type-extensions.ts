import 'redspot/types/config';

import { GasReporterConfig } from './types';

//@ts-ignore
declare module 'redspot/types/config' {
  interface HardhatUserConfig {
    gasReporter?: Partial<GasReporterConfig>;
  }
}
