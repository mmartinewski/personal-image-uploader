import { Router } from 'express';
import { outputsRepo } from '../../database/repos/outputs.repo.js';
import { validateNewOutput, validateOutputPatch } from '../validation.js';

export const outputsRouter = Router();

outputsRouter.get('/', (_req, res) => {
  res.json(outputsRepo.listAll());
});

outputsRouter.post('/', (req, res, next) => {
  try {
    const data = validateNewOutput(req.body);
    const output = outputsRepo.create(data);
    res.status(201).json(output);
  } catch (err) {
    next(err);
  }
});

outputsRouter.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = outputsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Output not found' });
      return;
    }

    const patch = validateOutputPatch(existing, req.body);
    const updated = outputsRepo.update(id, patch);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

outputsRouter.delete('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = outputsRepo.getById(id);
    if (!existing) {
      res.status(404).json({ error: 'Output not found' });
      return;
    }
    outputsRepo.delete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
