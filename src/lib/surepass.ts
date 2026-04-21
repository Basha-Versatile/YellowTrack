import "server-only";
import axios, { AxiosError } from "axios";
import { env } from "./env";
import {
  AppError,
  BadRequestError,
  ServiceUnavailableError,
} from "./errors";

type SurepassEnvelope<T> = {
  success?: boolean;
  message?: string;
  message_code?: string;
  data?: T;
};

export async function fetchRcDetails<T = unknown>(
  registrationNumber: string,
): Promise<T> {
  if (!env.SUREPASS_ENABLED) {
    throw new AppError("RTA lookup is disabled (SUREPASS_ENABLED=false)", 503);
  }
  if (!env.SUREPASS_API_TOKEN) {
    throw new AppError("Surepass credentials not configured", 500);
  }

  try {
    const { data } = await axios.post<SurepassEnvelope<T>>(
      `${env.SUREPASS_BASE_URL}/rc/rc-full`,
      { id_number: registrationNumber },
      {
        headers: {
          Authorization: `Bearer ${env.SUREPASS_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: env.SUREPASS_TIMEOUT_MS,
      },
    );

    if (!data?.success || !data.data) {
      throw new ServiceUnavailableError(
        data?.message || "RTA lookup returned no data",
      );
    }
    return data.data;
  } catch (err) {
    if (err instanceof AppError) throw err;

    const axiosErr = err as AxiosError<SurepassEnvelope<unknown>>;
    if (axiosErr.code === "ECONNABORTED" || axiosErr.code === "ETIMEDOUT") {
      throw new AppError("RTA lookup timed out — please try again", 504);
    }

    const res = axiosErr.response;
    if (res) {
      const status = res.status;
      const upstreamMsg =
        res.data?.message || res.data?.message_code || `HTTP ${status}`;

      if (status === 404 || status === 422) {
        throw new BadRequestError(
          `Registration number ${registrationNumber} not found in RTA database`,
        );
      }
      if (status === 401 || status === 403) {
        console.error("[Surepass] Auth failure:", upstreamMsg);
        throw new AppError(
          "RTA lookup authentication failed — contact admin",
          500,
        );
      }
      if (status === 429) {
        throw new AppError(
          "Too many RTA lookups — please try again shortly",
          429,
        );
      }
      if (status >= 500) {
        throw new AppError(
          "RTA lookup service is temporarily unavailable",
          502,
        );
      }
      throw new AppError(`RTA lookup failed: ${upstreamMsg}`, 502);
    }

    throw new AppError("Could not reach RTA lookup service", 502);
  }
}
