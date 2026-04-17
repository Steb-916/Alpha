/**
 * Quant Engine client.
 *
 * The Quant Engine is a Python FastAPI microservice (deployed separately on
 * Railway/Fly.io) that handles the heavy numerical work — SVI vol-surface
 * fitting, Breeden-Litzenberger RND extraction, vol cone percentiles, VRP,
 * skew + term structure.
 *
 * This client wrapper is stateless. When QUANT_ENGINE_URL is unset, every
 * method returns null (inert mode) so the cron and routes can degrade
 * gracefully — the Deribit chain pipeline keeps working and UI shows the
 * raw chain + put/call ratio + max pain even without compute.
 */

import type {
  RNDInput,
  RNDOutput,
  SkewInput,
  SkewOutput,
  VRPInput,
  VRPOutput,
  VolConeInput,
  VolConeOutput,
  VolSurfaceInput,
  VolSurfaceOutput,
} from '@/types/options';

class QuantEngineClient {
  readonly configured: boolean;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.QUANT_ENGINE_URL || '';
    this.apiKey = process.env.QUANT_ENGINE_API_KEY || '';
    this.configured = this.baseUrl.length > 0;
  }

  async computeVolSurface(
    input: VolSurfaceInput,
  ): Promise<VolSurfaceOutput | null> {
    return this.post<VolSurfaceInput, VolSurfaceOutput>(
      '/vol-surface',
      input,
    );
  }

  async computeRND(input: RNDInput): Promise<RNDOutput | null> {
    return this.post<RNDInput, RNDOutput>('/rnd', input);
  }

  async computeVolCone(input: VolConeInput): Promise<VolConeOutput | null> {
    return this.post<VolConeInput, VolConeOutput>('/vol-cone', input);
  }

  async computeVRP(input: VRPInput): Promise<VRPOutput | null> {
    return this.post<VRPInput, VRPOutput>('/vrp', input);
  }

  async computeSkew(input: SkewInput): Promise<SkewOutput | null> {
    return this.post<SkewInput, SkewOutput>('/skew', input);
  }

  private async post<I, O>(path: string, input: I): Promise<O | null> {
    if (!this.configured) return null;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Quant-Key': this.apiKey,
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.warn(
          `[quant-engine] ${path} → ${res.status} ${res.statusText}`,
        );
        return null;
      }
      return (await res.json()) as O;
    } catch (err) {
      console.warn(
        `[quant-engine] ${path} failed:`,
        (err as Error).message,
      );
      return null;
    }
  }
}

export const quantEngine = new QuantEngineClient();
