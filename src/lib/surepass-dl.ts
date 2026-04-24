import "server-only";
import axios, { AxiosError } from "axios";
import { env } from "./env";
import {
  AppError,
  BadRequestError,
  ServiceUnavailableError,
} from "./errors";

type DlEnvelope<T> = {
  success?: boolean;
  message?: string;
  message_code?: string;
  status_code?: number;
  data?: T;
};

/**
 * Shape returned by Surepass sandbox DL endpoint
 *   POST https://sandbox.surepass.io/api/v1/driving-license/driving-license
 *   body: { id_number, dob }   (dob format: YYYY-MM-DD)
 */
export type SurepassDlData = {
  client_id: string;
  license_number: string;
  state?: string;
  name: string;
  permanent_address?: string;
  permanent_zip?: string;
  temporary_address?: string;
  temporary_zip?: string;
  citizenship?: string;
  ola_name?: string;
  ola_code?: string;
  gender?: string;
  father_or_husband_name?: string;
  dob?: string;
  doe?: string;
  transport_doe?: string;
  doi?: string;
  transport_doi?: string;
  /** base64-encoded image (with or without data URI prefix) */
  profile_image?: string;
  has_image?: boolean;
  blood_group?: string;
  vehicle_classes?: string[];
  less_info?: boolean;
};

export async function fetchDrivingLicense(
  licenseNumber: string,
  dob: string,
): Promise<SurepassDlData> {
  if (!env.SUREPASS_DL_ENABLED) {
    throw new AppError(
      "DL lookup is disabled (SUREPASS_DL_ENABLED=false)",
      503,
    );
  }
  if (!env.SUREPASS_DL_API_TOKEN) {
    throw new AppError("Surepass DL credentials not configured", 500);
  }
  if (!licenseNumber || !dob) {
    throw new BadRequestError("License number and date of birth are required");
  }

  try {
    const { data } = await axios.post<DlEnvelope<SurepassDlData>>(
      `${env.SUREPASS_DL_BASE_URL}/driving-license/driving-license`,
      { id_number: licenseNumber, dob },
      {
        headers: {
          Authorization: `Bearer ${env.SUREPASS_DL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: env.SUREPASS_DL_TIMEOUT_MS,
      },
    );

    if (!data?.success || !data.data) {
      throw new ServiceUnavailableError(
        data?.message || "DL lookup returned no data",
      );
    }
    return data.data;
  } catch (err) {
    if (err instanceof AppError) throw err;

    const axiosErr = err as AxiosError<DlEnvelope<unknown>>;
    if (axiosErr.code === "ECONNABORTED" || axiosErr.code === "ETIMEDOUT") {
      throw new AppError("DL lookup timed out — please try again", 504);
    }

    const res = axiosErr.response;
    if (res) {
      const status = res.status;
      const upstreamMsg =
        res.data?.message || res.data?.message_code || `HTTP ${status}`;

      console.error("[SurepassDL] Upstream error", {
        status,
        url: `${env.SUREPASS_DL_BASE_URL}/driving-license/driving-license`,
        licenseNumber,
        message: upstreamMsg,
        body: res.data,
      });

      if (status === 404 || status === 422) {
        throw new BadRequestError(
          `Driving license ${licenseNumber} not found or DOB mismatch`,
        );
      }
      if (status === 401 || status === 403) {
        throw new AppError(
          "DL lookup authentication failed — contact admin",
          500,
        );
      }
      if (status === 429) {
        throw new AppError(
          "Too many DL lookups — please try again shortly",
          429,
        );
      }
      if (status >= 500) {
        throw new AppError(
          `DL lookup upstream ${status}: ${upstreamMsg}`,
          502,
        );
      }
      throw new AppError(`DL lookup failed: ${upstreamMsg}`, 502);
    }

    console.error("[SurepassDL] Network error (no response)", {
      code: axiosErr.code,
      message: axiosErr.message,
      url: `${env.SUREPASS_DL_BASE_URL}/driving-license/driving-license`,
    });
    throw new AppError("Could not reach DL lookup service", 502);
  }
}
