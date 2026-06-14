// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: LicenseRef-Proprietary
import type { ValidateFunction } from "ajv";

export const precompiledValidators: Readonly<Record<string, ValidateFunction<unknown>>>;
