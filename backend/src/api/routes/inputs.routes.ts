import { Router } from 'express';
import { inputsRepo } from '../../database/repos/inputs.repo.js';
import * as inputSync from '../../monitor/inputSync.js';
import { parseUploadAfter, validateNewInput } from '../validation.js';

export const inputsRouter = Router();

inputsRouter.get('/', (_req, res) => {
  res.json(inputsRepo.listAll());
});

inputsRouter.post('/', (req, res, next) => {
  try {
    const data = validateNewInput(req.body);
    const input = inputsRepo.create(data);
    inputSync.notifyCreate(input);
    res.status(201).json(input);
  } catch (err) {
    next(err);
  }
});

inputsRouter.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = inputsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Input not found' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const uploadAfter = parseUploadAfter(body.upload_after);
    const updated = inputsRepo.update(id, {
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      source_path:
        body.source_path !== undefined ? String(body.source_path).trim() : existing.source_path,
      type: existing.type,
      extensions:
        body.extensions !== undefined
          ? (body.extensions as string[]).map((e) => String(e).toLowerCase().replace(/^\./, ''))
          : existing.extensions,
      upload_after: uploadAfter !== undefined ? uploadAfter : existing.upload_after,
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : existing.is_active,
    });
    inputSync.notifyUpdate(existing, updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

inputsRouter.delete('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = inputsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Input not found' });
      return;
    }
    inputSync.notifyDelete(existing);
    inputsRepo.delete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
