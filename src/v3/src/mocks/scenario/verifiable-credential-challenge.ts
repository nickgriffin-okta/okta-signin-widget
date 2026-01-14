/*
 * Copyright (c) 2022-present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

import { scenario } from '../registry';

let pollCount = 0;

scenario('verifiable-credential-challenge', (rest) => {
  // Reset poll count when scenario loads
  pollCount = 0;

  return [
    // bootstrap
    rest.get('*/oauth2/default/.well-known/openid-configuration', async (req, res, ctx) => {
      const { default: body } = await import('../response/oauth2/default/well-known/openid-configuration/default.json');
      return res(
        ctx.status(200),
        ctx.json(body),
      );
    }),
    rest.post('*/oauth2/default/v1/interact', async (req, res, ctx) => {
      const { default: body } = await import('../response/oauth2/default/v1/interact/default.json');
      return res(
        ctx.status(200),
        ctx.json(body),
      );
    }),
    // introspect returns default identify screen
    rest.post('*/idp/idx/introspect', async (req, res, ctx) => {
      const { default: body } = await import('../response/idp/idx/introspect/default.json');
      return res(
        ctx.status(200),
        ctx.json(body),
      );
    }),
    rest.post('*/idp/idx/identify', async (req, res, ctx) => {
      const { default: body } = await import('../response/idp/idx/identify/default.json');
      return res(
        ctx.status(200),
        ctx.json(body),
      );
    }),
    rest.post('*/idp/idx/recover', async (req, res, ctx) => {
      const { default: body } = await import('../response/idp/idx/introspect/verifiable-credential-challenge.json');
      return res(
        ctx.status(200),
        ctx.json(body),
      );
    }),
    // poll - returns VDC challenge (pending) a few times, then success
    /*rest.post('*!/idp/idx/challenge/poll', async (req, res, ctx) => {
      pollCount++;
      console.log(`[VDC Mock] Poll attempt ${pollCount}`);

      if (pollCount < 3) {
        // Keep returning VDC challenge (pending state)
        const { default: body } = await import('../response/idp/idx/introspect/verifiable-credential-challenge.json');
        return res(
          ctx.status(200),
          ctx.json(body),
        );
      }
      // After 3 polls, return success
      const { default: body } = await import('../response/idp/idx/consent/success.json');
      return res(
        ctx.status(200),
        ctx.json(body),
      );
    }),*/
    rest.post('*/idp/idx/challenge/answer', async (req, res, ctx) => {
      const { default: body } = await import('../response/idp/idx/consent/success.json');
      return res(
        ctx.status(200),
        ctx.json(body),
      );
    }),
    // cancel
    rest.post('*/idp/idx/cancel', async (req, res, ctx) => {
      const { default: body } = await import('../response/idp/idx/introspect/default.json');
      return res(
        ctx.status(200),
        ctx.json(body),
      );
    }),
  ];
});

