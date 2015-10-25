///<reference path="../../node_modules/tsd-goalazo-models/models.d.ts"/>
///<reference path="../../typings/q/Q.d.ts"/>
///<reference path="../../typings/bcrypt/bcrypt.d.ts"/>
///<reference path="../../typings/express/express.d.ts"/>
///<reference path="../../typings/jsonwebtoken/jsonwebtoken.d.ts"/>

import IAuthUser = goalazo.IAuthUser;
import {CodeError, ErrorCode} from "../../uitils/CodeError";
import Promise = Q.Promise;
import IFilter = goalazo.IFilter;
import {FilterSvcUno} from "../filter/FilterSvcUno";
var uuid = require('node-uuid');
import express = require('express');
import bcrypt = require('bcrypt');
import crypto = require('crypto');
import Q = require('q');
import jwt = require('jsonwebtoken');
import {config} from '../../config';
import {IUserInstance} from "../../typings/custom/models";
import {UserRepoUno} from "../../repositiories/user/UserRepoUno";
import IUser = goalazo.IUser;

export class UserSvcUno {

    protected userRepo: UserRepoUno;
    protected filterService: FilterSvcUno;

    constructor() {
        this.userRepo = new UserRepoUno();
        this.filterService = new FilterSvcUno();
    }

    public register(name?: string, password?: string): Promise<IAuthUser> {
        var generateUserPromise: Promise<IUser>;

        if (!name && !password) {

            generateUserPromise = this.userRepo.setUser(
                true,
                uuid.v1() // generate random name based on type
            );
        } else {

            generateUserPromise = this.hashPassword(password)
                .then((hashedPassword) => this.userRepo.setUser(false, name, hashedPassword));
        }

        return generateUserPromise
            .then((user: IUser) => this.getAuthUser(user))
    }

    public authenticate(name: string, password: string): Promise<IAuthUser> {

        return this.userRepo.getUser(name)
            .then((user: IUser) => {

                if (!user) {
                    throw new CodeError('authentication failed', ErrorCode.AuthenticationFailed);
                }

                if (user.isAutoGenerated) {
                    return user;
                }

                if (password) {

                    return this.comparePasswordWithHashedPassword(password, user.password)
                        .then((isValid) => {

                            if (isValid) {
                                return user;
                            }
                        });
                }

                throw new CodeError('authentication failed', ErrorCode.AuthenticationFailed);
            })
            .then((user: IUser) => this.getAuthUser(user))
            ;
    }

    public checkAuthentication(token: string): Promise<IAuthUser> {

        return Q.Promise((resolve, reject) => {

            jwt.verify(token, config.jwtSecret, (err, user) => {

                console.log(err, user);

                if (err) {

                    reject(err);
                } else {

                    resolve(this.getAuthUser(user));
                }
            });
        });
    }

    public getUserFilters(user: IAuthUser, limit: number): Promise<Array<IFilter>> {

        return this.userRepo.getUserFilters(user.id, limit);
    }

    public setUserFilter(user: IAuthUser, filterName: string,
                         teamIds: Array<number>,
                         competitionSeriesIds: Array<number>): Promise<void> {

        return this.userRepo.getTransactionPromise()
            .then((transaction) => {

                return this.filterService.setFilter(filterName, teamIds, competitionSeriesIds, transaction)
                    .then((filter: IFilter) => this.userRepo.setUserFilter(user.id, filter.id, transaction))
                    .then(() => transaction.commit())
                    .catch((err) => {
                        transaction.rollback();

                        // pass error
                        throw err;
                    })
                    ;
            });

    }

    protected getAuthUser(user: IUser): IAuthUser {

        var authUser: IAuthUser = {
            id: user.id,
            name: user.name,
            isAdmin: user.isAdmin,
            isAutoGenerated: user.isAutoGenerated,
            registrationDate: user.registrationDate,
        };

        authUser.token = this.getToken(authUser);

        return authUser;
    }

    protected getToken(user: IAuthUser) {

        return jwt.sign(user, config.jwtSecret, {
            expiresIn: "24h" // expires in 24h
        });
    }

    /**
     * password gets peppered (config.passwordPepper), hashed (sha256)
     * and salted by bcrypt
     * @param password
     * @return {Promise<string>}
     */
    protected hashPassword(password: string): Promise<string> {

        return Q.Promise<string>((resolve, reject) => {

            bcrypt.hash(this.pepperPassword(password), 10, (err: Error, hashedPassword: string) => {

                if (err) {

                    reject(err);
                } else {

                    resolve(hashedPassword);
                }
            })
        });
    }

    protected comparePasswordWithHashedPassword(password, hashedPassword): Promise<boolean> {

        return Q.Promise<boolean>((resolve, reject) => {

            bcrypt.compare(this.pepperPassword(password), hashedPassword, (err: Error, isValid: boolean) => {

                if (err) {

                    reject(err);
                } else {

                    resolve(isValid);
                }
            });
        });

    }

    protected pepperPassword(password: string) {

        return crypto.createHash('sha256').update(password + config.passwordPepper).digest('base64');
    }
}
