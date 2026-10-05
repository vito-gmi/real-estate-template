import { pgEnum } from 'drizzle-orm/pg-core';
import {
  conditions,
  constructionTypes,
  currencies,
  dealTypes,
  furnishingTypes,
  heatingTypes,
  inquiryKinds,
  inquiryStatuses,
  listingStatuses,
  locationLevels,
  mediaKinds,
  propertyKinds,
  userRoles,
} from '@/lib/domain/enums';

/**
 * Postgres enums are generated from the domain vocabulary rather than retyped,
 * so the database can never drift from the application's idea of valid values.
 */

export const dealTypeEnum = pgEnum('deal_type', dealTypes);
export const propertyKindEnum = pgEnum('property_kind', propertyKinds);
export const listingStatusEnum = pgEnum('listing_status', listingStatuses);
export const constructionTypeEnum = pgEnum('construction_type', constructionTypes);
export const heatingTypeEnum = pgEnum('heating_type', heatingTypes);
export const furnishingEnum = pgEnum('furnishing', furnishingTypes);
export const conditionEnum = pgEnum('listing_condition', conditions);
export const currencyEnum = pgEnum('currency', currencies);
export const mediaKindEnum = pgEnum('media_kind', mediaKinds);
export const inquiryStatusEnum = pgEnum('inquiry_status', inquiryStatuses);
export const inquiryKindEnum = pgEnum('inquiry_kind', inquiryKinds);
export const userRoleEnum = pgEnum('user_role', userRoles);
export const locationLevelEnum = pgEnum('location_level', locationLevels);
export const localeEnum = pgEnum('locale', ['bg', 'en']);
