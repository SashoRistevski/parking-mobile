// @ts-nocheck — node:test types and .ts import extension are runtime-only (Node strip-types).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localeFromStored } from '../../src/i18n/localeParse.ts';

describe('localeFromStored', () => {
  it('returns mk and en from a valid stored payload', () => {
    assert.equal(localeFromStored({ locale: 'mk' }), 'mk');
    assert.equal(localeFromStored({ locale: 'en' }), 'en');
  });

  it('returns null for missing or invalid file shapes', () => {
    assert.equal(localeFromStored(undefined), null);
    assert.equal(localeFromStored(null), null);
    assert.equal(localeFromStored({}), null);
    assert.equal(localeFromStored(true), null);
    assert.equal(localeFromStored(false), null);
    assert.equal(localeFromStored('mk'), null);
    assert.equal(localeFromStored(1), null);
    assert.equal(localeFromStored({ locale: 'de' }), null);
    assert.equal(localeFromStored({ locale: 'MK' }), null);
    assert.equal(localeFromStored({ locale: 1 }), null);
    assert.equal(localeFromStored({ locale: null }), null);
    assert.equal(localeFromStored({ locale: undefined }), null);
    assert.equal(localeFromStored([]), null);
    assert.equal(localeFromStored([{ locale: 'mk' }]), null);
    assert.equal(localeFromStored(['mk']), null);
  });
});
