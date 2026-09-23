import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ExternalServiceError,
  InternalServerError,
} from '../../src/common/errors/app-error.js';

describe('AppError Hierarchy', () => {
  it('should construct Base AppError correctly', () => {
    const error = new AppError('Custom message', 418, true, { foo: 'bar' });
    assert.equal(error.message, 'Custom message');
    assert.equal(error.statusCode, 418);
    assert.equal(error.isOperational, true);
    assert.deepEqual(error.details, { foo: 'bar' });
    assert.equal(error.name, 'AppError');
  });

  it('should construct BadRequestError with status 400', () => {
    const error = new BadRequestError('Invalid input');
    assert.equal(error.statusCode, 400);
    assert.equal(error.isOperational, true);
    assert.equal(error.message, 'Invalid input');
  });

  it('should construct UnauthorizedError with status 401', () => {
    const error = new UnauthorizedError();
    assert.equal(error.statusCode, 401);
    assert.equal(error.isOperational, true);
  });

  it('should construct ForbiddenError with status 403', () => {
    const error = new ForbiddenError();
    assert.equal(error.statusCode, 403);
    assert.equal(error.isOperational, true);
  });

  it('should construct NotFoundError with status 404', () => {
    const error = new NotFoundError('Task not found');
    assert.equal(error.statusCode, 404);
    assert.equal(error.isOperational, true);
    assert.equal(error.message, 'Task not found');
  });

  it('should construct ExternalServiceError with status 502', () => {
    const error = new ExternalServiceError('Google Sheets', 'Quota exceeded');
    assert.equal(error.statusCode, 502);
    assert.equal(error.isOperational, true);
    assert.match(error.message, /Google Sheets/);
    assert.match(error.message, /Quota exceeded/);
  });

  it('should construct InternalServerError with status 500 and non-operational', () => {
    const error = new InternalServerError('Crash');
    assert.equal(error.statusCode, 500);
    assert.equal(error.isOperational, false);
  });
});
