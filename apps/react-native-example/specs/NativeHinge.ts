import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type HingeUpdate = {
  // False where the window has no hinge: every iPhone but the Duo.
  available: boolean;
  // Radians, 0 closed to π flat.
  angle: number;
  // UIHingeStatus: 0 unknown, 1 closed, 2 partially open, 3 fully open.
  status: number;
};

export interface Spec extends TurboModule {
  readonly onChange: CodegenTypes.EventEmitter<HingeUpdate>;
  start(): void;
  stop(): void;
}

export default TurboModuleRegistry.get<Spec>('Hinge');
