import { z } from 'zod'
import i18next from 'i18next'
import { zodI18nMap } from 'zod-i18n-map'
import translation from 'zod-i18n-map/locales/pt/zod.json'

function main() {
    i18next.init({
        lng: "pt",
        resources: {
            pt: { zod: translation },
        },
    });
    z.setErrorMap(zodI18nMap);

    try {
        const auth = z.object({ email: z.string().email(), password: z.string().min(6) })
        auth.parse({ email: 'invalid', password: '123' })
    } catch(e) {
        console.log("Error:", JSON.stringify(e, null, 2))
    }
}
main()
