import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { checkSessionIdExists } from '../middlewares/check-session-id-exists';
import { prisma } from '../lib/prisma';

export async function mealsRoutes(app: FastifyInstance) {
    app.post('/', async (req, res) => {
        const createMealBodySchema = z.object({
            name: z.string(),
            description: z.string(),
            date: z.string().datetime({ offset: true }),
            is_diet: z.boolean(),
        });

        const { name, description, date, is_diet } = createMealBodySchema.parse(req.body);
        let session_id = req.cookies.session_id;

        if (!session_id) {
            session_id = randomUUID();

            res.cookie('session_id', session_id, {
                path: '/',
                maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
            });
        }

        await prisma.meal.create({
            data: {
                name,
                description,
                date,
                is_diet,
                session_id
            }
        });

        return res.status(201).send();
    });

    app.get('/', { preHandler: [checkSessionIdExists] }, async (req, res) => {
        const { session_id }  = req.cookies;

        const meals = await prisma.meal.findMany({
            where: {
                session_id
            }
        });

        return { meals }
    });

    app.get('/:id', { preHandler: [checkSessionIdExists] }, async (req, res) => {
        const getMealsParamschema = z.object({
            id: z.string().uuid(),
        });

        const { id } = getMealsParamschema.parse(req.params);
        const { session_id }  = req.cookies;

        const meal = await prisma.meal.findMany({
            where: {
                session_id,
                id
            }
        });

        return { meal }
    });

    app.put('/:id', { preHandler: [checkSessionIdExists] }, async (req, res) => {
        const getMealsParamschema = z.object({
            id: z.string().uuid(),
        });

        const putBodySchema = z.object({
            name: z.string().optional(),
            description: z.string().optional(),
            date: z.string().datetime({ offset: true }).optional(),
            is_diet: z.boolean().optional(),
        });

        const { id } = getMealsParamschema.parse(req.params);
        const { session_id }  = req.cookies;

        const { name, description, date, is_diet } = putBodySchema.parse(req.body);

        let meal = await prisma.meal.findFirst({
            where: {
                session_id,
                id
            }
        });

        if (!meal) {
            return res.status(400).send({ 
                error: 'meal not found' 
            })
        }

        meal.name = name ? name : meal.name;
        meal.description = description ? description : meal.description;
        meal.date = date ? date: meal.date;
        meal.is_diet = is_diet != undefined ? is_diet : meal.is_diet;

        console.log(meal);

        await prisma.meal.update({
            where: {
                id,
            },
            data: {
                name: meal.name,
                description: meal.description,
                date: meal.date,
                is_diet: meal.is_diet
            }
        });

        return res.status(202).send();
    });

    app.delete('/:id', { preHandler: [checkSessionIdExists] }, async (req, res) => {
        const getMealsParamschema = z.object({
            id: z.string().uuid(),
        });

        const { id } = getMealsParamschema.parse(req.params);
        const { session_id }  = req.cookies;

        let meal = await prisma.meal.findFirst({
            where: {
                session_id,
                id
            }
        });

        if (!meal) {
            return res.status(400).send({ 
                error: 'meal not found' 
            })
        }

        await prisma.meal.delete({
            where: {
                id,
            }
        });

        return res.status(202).send();
    });

    app.get('/summary', { preHandler: [checkSessionIdExists] }, async (req, res) => {
        const { session_id }  = req.cookies;

        const totalMeals = await prisma.meal.count({
            where: {
                session_id
            },
        });

        const totalMealsInDiet = await prisma.meal.count({
            where: {
                session_id,
                is_diet: true
            }
        });

        const totalOffDietMeals = await prisma.meal.count({
            where: {
                session_id,
                is_diet: false
            }
        });

        const bestSequel = Math.round(totalMealsInDiet / totalMeals);

        console.log(bestSequel);

        const summary = {
            totalMeals,
            totalMealsInDiet,
            totalOffDietMeals,
            bestSequel
        };

        return { summary }
    });
}