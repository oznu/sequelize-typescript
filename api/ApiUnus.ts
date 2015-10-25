///<reference path="../typings/bluebird/bluebird.d.ts"/>
///<reference path="../typings/q/Q.d.ts"/>
///<reference path="../node_modules/tsd-goalazo-models/models.d.ts"/>
///<reference path="../node_modules/tsd-http-status-codes/HttpStatus.d.ts"/>

import express = require('express');
import Q = require('q');
import ICompetitionSeries = goalazo.ICompetitionSeries;
import ITeam = goalazo.ITeam;
import {config} from '../config';
import {ApiRequest} from '../typings/custom/requesting';
import {ApiAbstract} from './ApiAbstract';
import {TeamSvcUno} from "../services/Team/TeamSvcUno";
import {CompetitionSeriesSvcUno} from '../services/competitionSeries/CompetitionSeriesSvcUno';
import {ICompetitionTeamsRequest} from "../typings/custom/requesting";
import {CompetitionSvcUno} from "../services/competition/CompetitionSvcUno";
import {CountrySvcUno} from "../services/country/CountrySvcUno";
import {ICountryTeamsRequest} from "../typings/custom/requesting";
import {IUserRequest} from "../typings/custom/requesting";
import {UserSvcUno} from "../services/user/UserSvcUno";
import {IUserFilterPostRequest} from "../typings/custom/requesting";
import ICountry = goalazo.ICountry;
import ICompetition = goalazo.ICompetition;
import IAuthUser = goalazo.IAuthUser;
import {Util} from "../uitils/Util";
import {CodeError, ErrorCode} from "../uitils/CodeError";
import {FilterSvcUno} from "../services/filter/FilterSvcUno";
import IMatch = goalazo.IMatch;
import {IFilterMatchesGetRequest} from "../typings/custom/requesting";
import {IMatchViewingsGetRequest} from "../typings/custom/requesting";
import {MatchSvcUno} from "../services/match/MatchSvcUno";
import IViewing = goalazo.IViewing;

export class ApiUnus extends ApiAbstract {

    protected competitionSeriesSvc: CompetitionSeriesSvcUno;
    protected competitionSvc: CompetitionSvcUno;
    protected countrySvc: CountrySvcUno;
    protected teamSvc: TeamSvcUno;
    protected userSvc: UserSvcUno;
    protected filterSvc: FilterSvcUno;
    protected matchSvc: MatchSvcUno;

    constructor() {

        super();

        this.competitionSeriesSvc = new CompetitionSeriesSvcUno();
        this.competitionSvc = new CompetitionSvcUno();
        this.countrySvc = new CountrySvcUno();
        this.teamSvc = new TeamSvcUno();
        this.userSvc = new UserSvcUno();
        this.filterSvc = new FilterSvcUno();
        this.matchSvc = new MatchSvcUno();
    }

    // USER
    // --------------

    /**
     * @api {post} /users create user
     * @apiVersion 1.0.0
     * @apiName postUser
     * @apiGroup User
     *
     * @apiParam {String} [name]  Optional name of User.
     * @apiParam {String} [password]  Optional password of User.
     *
     * @apiDescription Create a new User. In case of no parameters an auto generated User will be created.
     *
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *      {
     *          "id": 9,
     *          "name": "4b6f8fb0-764d-11e5-987d-fb9ad068e903",
     *          "isAutoGenerated": true,
     *          "iat": 1445251005,
     *          "exp": 1445337405,
     *          "token": "eyJ0eXAiOiJKV1QiLCJh...t6DiEnyt4fcHQ"
     *      }
     *
     */
    postUser(req: IUserRequest, res: express.Response, next: any): void {

        var data = req.body;

        if ((!data.name && !data.password) ||
            data.name && data.password) {

            this.userSvc.register(data.name, data.password)
                .then((user) => res.json(user))
                .catch(next)
            ;
        } else {

            res.status(HttpStatus.BadRequest).send(`Both name and password should be provided
            or no parameter for an auto generated user`);
        }
    }

    /**
     * @api {post} /users/auth auth user
     * @apiVersion 1.0.0
     * @apiName authUser
     * @apiGroup User
     *
     * @apiParam {String} name  Name of User.
     * @apiParam {String} [password]  Optional password of User.
     *
     * @apiDescription Authenticate User and returns an User object with authentication token.
     *                  In case of no password, the User has to be auto generated, otherwise it
     *                  is not possible to authenticate.
     *
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *      {
     *          "id": 9,
     *          "name": "4b6f8fb0-764d-11e5-987d-fb9ad068e903",
     *          "isAutoGenerated": true,
     *          "iat": 1445251005,
     *          "exp": 1445337405,
     *          "token": "eyJ0eXAiOiJKV1QiLCJh...t6DiEnyt4fcHQ"
     *      }
     *
     */
    authUser(req: IUserRequest, res: express.Response, next: any): void {

        var data = req.body;

        this.userSvc.authenticate(data.name, data.password)
            .then((user) => res.json(user))
            .catch((err) => {

                if (err instanceof CodeError && (<CodeError>err).code === ErrorCode.AuthenticationFailed) {

                    res.sendStatus(HttpStatus.Forbidden);
                } else {
                    next(err);
                }
            })
        ;
    }

    /**
     * @api {get} /users/me/filters get user filters
     * @apiVersion 1.0.0
     * @apiName getUserFilters
     * @apiGroup User
     *
     *
     * @apiDescription There is at least one of these both parameters: teamIds or competitionSeriesIds necessary.
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *
     *      [
     *          {
     *              "id": 30,
     *              "name": "F.C. Hansa Rostock"
     *          },
     *          {
     *              "id": 31,
     *              "name": "1. Bundesliga"
     *          }
     *      ]
     *
     */
    getUserFilters(req: IUserRequest, res: express.Response, next: any): void {

        this.userSvc.getUserFilters(req.user, req.query.limit)
            .then((filters) => res.json(filters))
            .catch(next)
    }

    /**
     * @api {post} /users/me/filters create user filter
     * @apiVersion 1.0.0
     * @apiName postUserFilter
     * @apiGroup User
     *
     * @apiParam {String} filterName  Filter name of to be created Filter.
     * @apiParam {Integer[]} [teamIds]  IDs of Teams the Filter should be linked to.
     * @apiParam {Integer[]} [competitionSeriesIds]  IDs of CompetitionSeries the Filter should be linked to.
     *
     * @apiDescription Creates a new Filter linked to the current User.
     *              There is at least one of these both parameters: teamIds or competitionSeriesIds necessary.
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *
     */
    postUserFilter(req: IUserFilterPostRequest, res: express.Response, next: any): void {

        var data = req.body;

        data.teamIds = Util.toArrayIfExists<number>(data.teamIds);
        data.competitionSeriesIds = Util.toArrayIfExists<number>(data.competitionSeriesIds);

        if (data.filterName && (data.teamIds || data.competitionSeriesIds)) {

            this.userSvc.setUserFilter(req.user, data.filterName, data.teamIds, data.competitionSeriesIds)
                .then(() => res.sendStatus(HttpStatus.OK))
                .catch(next)
        } else {

            res.status(HttpStatus.BadRequest).send(`Parameters missing: filterName and teamIds or competitionSeriesIds`);
        }
    }

    // COUNTRIES
    // --------------

    /**
     * @api {get} /countries get countries
     * @apiVersion 1.0.0
     * @apiName getCountries
     * @apiGroup Country
     *
     * @apiParam {Integer} limit  Limit of country list.
     *
     * @apiDescription Returns a list of Countries (restricted by internal max limit).
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *
     *      [
     *          {
     *              "id": 1,
     *              "name": "Deutschland"
     *          },
     *          {
     *              "id": 2,
     *              "name": "Italien"
     *          }
     *      ]
     *
     */
    getCountries(req: ApiRequest, res: express.Response, next: any): void {

        this.countrySvc.getCountries(req.query.limit)
            .then((countries: ICountry[]) => {

                res.json(countries);
            })
            .catch(next)
    }


    /**
     * @api {get} /countries/:countryId/competitions get country competitions
     * @apiVersion 1.0.0
     * @apiName getCountryCompetitions
     * @apiGroup Country
     *
     * @apiParam {Integer} limit  Limit of country list.
     *
     * @apiDescription Returns a list of Competitions specified by Country.
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *
     *          [
     *          {
     *              "id": 2,
     *              "competitionSeriesId": 1,
     *              "seasonStart": "2015-10-07T21:10:10.000Z",
     *              "seasonEnd": "2015-10-07T21:10:10.000Z",
     *              "competition_series_id": 1,
     *              "competitionSeries": {
     *                  "*          id": 1,
     *                  "name": "Bundesliga"
     *              }
     *          }
     *          ]
     *
     *
     */
    getCountryCompetitions(req: ICountryTeamsRequest, res: express.Response, next: any): void {

        this.countrySvc.getCountryCompetitions(req.params.countryId, req.query.limit)
            .then((competitions: ICompetition[]) => {

                res.json(competitions);
            })
            .catch(next);
    }

    // COMPETITION SERIES
    // --------------

    /**
     * @api {get} /competition-series get competition series
     * @apiVersion 1.0.0
     * @apiName getCompetitionSeries
     * @apiGroup CompetitionSeries
     *
     * @apiParam {Integer} limit  Limit of country list.
     *
     * @apiDescription Returns a list of Competition Series (restricted by limit).
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *
     *          [
     *              {
     *                  "id": 1,
     *                  "name": "Bundesliga"
     *              }
     *          ]
     *
     */
    getCompetitionSeries(req: ApiRequest, res: express.Response, next: any): void {

        Q.when<ICompetitionSeries[]>(null)
            .then(() => this.competitionSeriesSvc.getCompetitionSeries(req.query.limit))
            .then((competitionSeries: ICompetitionSeries[]) => {

                res.json(competitionSeries);
            })
            .catch(next)
        ;
    }

    // COMPETITION
    // --------------

    /**
     * @api {get} /competition/:competitionId/team get competition teams
     * @apiVersion 1.0.0
     * @apiName getCompetitionTeams
     * @apiGroup Competition
     *
     * @apiParam {Integer} limit  Limit of country list.
     *
     * @apiDescription Returns a list of Competition Teams (restricted by limit).
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *
     *          [
     *              {
     *                  "id": 1,
     *                  "name": "Bundesliga"
     *              }
     *          ]
     *
     */
    getCompetitionTeams(req: ICompetitionTeamsRequest, res: express.Response, next: any): void {

        Q.when<ITeam[]>(null)
            .then(() => this.competitionSvc.getCompetitionTeams(req.params.competitionId, req.query.limit))
            .then((teams: ITeam[]) => {

                res.json(teams);
            })
            .catch(next)

    }

    // FILTER
    // --------------

    /**
     * @api {get} /filters/:filterId/matches get filter matches
     * @apiVersion 1.0.0
     * @apiName getFilterMatches
     * @apiGroup Filter
     *
     * @apiDescription Returns a list of matches referring a specified filter.
     *
     * @apiParam {Integer} limit  Limit of Match list.
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *
     *      [
     *      {
     *        "id": 1,
     *        "teamHomeId": 1,
     *        "teamAwayId": 2,
     *        "competitionId": 2,
     *        "kickOff": "2015-10-25T18:00:00.000Z",
     *        "homeTeam": {
     *          "id": 1,
     *          "name": "F.C. Hansa Rostock"
     *        },
     *        "awayTeam": {
     *          "id": 2,
     *          "name": "F.C. Bayern München"
     *        }
     *      }
     ]
     *
     */
    getFilterMatches(req: IFilterMatchesGetRequest, res: express.Response, next: any): void {

        Q.when<IMatch[]>(null)
            .then(() => this.filterSvc.getFilterMatches(req.params.filterId, req.query.limit))
            .then((matches: IMatch[]) => {

                res.json(matches);
            })
            .catch(next)
        ;
    }

    // MATCH
    // --------------

    /**
     * @api {get} /matches/:matchId/viewings get match viewings
     * @apiVersion 1.0.0
     * @apiName getMatchViewings
     * @apiGroup Match
     *
     * @apiDescription Returns a list of viewings referring a specified match.
     *
     * @apiParam {Double} longitude1  Defines a coordinate of a map section.
     * @apiParam {Double} longitude2  Defines a coordinate of a map section.
     * @apiParam {Double} latitude1  Defines a coordinate of a map section.
     * @apiParam {Double} latitude2  Defines a coordinate of a map section.
     *
     * @apiSuccessExample Success-Response:
     *      HTTP/1.1 200 OK
     *
     *      [
     *      {
     *        "id": 1,
     *        "matchId": 1,
     *        "locationId": 1,
     *        "startTime": "2015-10-25T17:45:00.000Z",
     *        "location": {
     *          "position": {
     *            "longitude": 13.57833,
     *            "latitude": 52.45471
     *          },
     *          "id": 1,
     *          "longitude": 13.57833,
     *          "latitude": 52.45471,
     *          "address": "Puchanstr. 16",
     *          "postCode": "12555",
     *          "city": "Berlin",
     *          "country": "Deutschland"
     *        }
     *      }
     *      ]
     *
     */
    getMatchViewings(req: IMatchViewingsGetRequest, res: express.Response, next: any): void {

        var data = req.query;

        if (data.longitude1 && data.longitude2 && data.latitude1 && data.latitude2) {

            this.matchSvc.getMatchViewings(req.params.matchId,
                data.longitude1, data.longitude2, data.latitude1, data.latitude2)
                .then((viewings: IViewing[]) => {

                    res.json(viewings);
                })
                .catch(next)
            ;
        } else {
            res.status(HttpStatus.BadRequest).send(`Parameters missing: longitude1 & 2 &
                                                    latitude1 & 2 are required`)
        }
    }

    // TEAM
    // --------------

    getTeams(req: ApiRequest, res: express.Response, next: any): void {

        Q.when<ITeam[]>(null)
            .then(() => this.teamSvc.getTeams())
            .then((teams: ITeam[]) => {

                res.json(teams);
            })
            .catch(next)
        ;
    }

    // MIDDLEWARE
    // ---------------------------

    checkRequestFilterMiddleware(req: ApiRequest, res: express.Response, next: Function) {

        if (req.query.limit !== undefined && req.query.limit > config.request.maxLimit) {

            // if limit is higher than configured max
            // response with BAD REQUEST
            res.status(HttpStatus.BadRequest).send('Maximal limit for data request is ' + config.request.maxLimit);
            return;
        } else {

            // if no limit is defined, set limit to maxLimit
            req.query.limit = config.request.maxLimit;
        }
        next();
    }

    checkAuthenticationMiddleWare(req: ApiRequest, res: express.Response, next: any): void {

        var token = req.headers[config.request.accessTokenHeader];

        if (!token) {

            res.sendStatus(HttpStatus.Unauthorized);
        }

        this.userSvc.checkAuthentication(token)
            .then((user: IAuthUser) => {

                req.user = user;
                next();
            })
            .catch(() => {

                res.sendStatus(HttpStatus.Unauthorized);
            })
    }
}

