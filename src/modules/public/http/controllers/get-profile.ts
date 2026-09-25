import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'

export async function getProfile(request: FastifyRequest, reply: FastifyReply) {
  const prisma = requestContext.get('prisma')

  if (!prisma) {
    return reply.status(500).send({ message: 'Internal server error: Prisma client not found in context.' })
  }

  try {
    const profile = await prisma.companyProfile.findFirst({
      include: {
        businessHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    })

    if (!profile) {
      return reply.status(200).send(null)
    }

    // Buscar formas de pagamento ativas para o delivery / cardápio
    let publicPayments: any[] = [];
    try {
      publicPayments = await prisma.payment.findMany({
        where: {
          active: true,
          active_for_out: true,
        },
        select: {
          id: true,
          name: true,
          in_sight: true,
          installment_limit: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch { }

    let deliverySectors = profile.deliverySectors || [];
    if (typeof deliverySectors === 'string') {
      try {
        deliverySectors = JSON.parse(deliverySectors);
      } catch {
        deliverySectors = [];
      }
    }
    if (!Array.isArray(deliverySectors)) deliverySectors = [];

    const googleReviewConfig = deliverySectors.find((s: any) => s?._type === 'google_review_config');
    const googleReviewUrl = googleReviewConfig?.url || '';
    const neighborhoodPolicy = deliverySectors.find((s: any) => s?._type === 'neighborhood_policy')?.mode === 'STRICT' ? 'STRICT' : 'FALLBACK';
    // Tema do cardápio (basic | premium): guardado na mesma lista de configurações, sem migração de banco
    const menuThemeEntry = deliverySectors.find((s: any) => s?._type === 'menu_theme');
    const menuThemePreset = typeof menuThemeEntry?.preset === 'string' && menuThemeEntry.preset ? menuThemeEntry.preset : 'basic';
    const menuTheme = menuThemeEntry?.overrides && typeof menuThemeEntry.overrides === 'object' ? menuThemeEntry.overrides : null;
    deliverySectors = deliverySectors.filter((s: any) => s?._type !== 'google_review_config' && s?._type !== 'neighborhood_policy' && s?._type !== 'menu_theme');

    let availableNeighborhoods = profile.availableNeighborhoods || [];
    if (typeof availableNeighborhoods === 'string') {
      try {
        availableNeighborhoods = JSON.parse(availableNeighborhoods);
      } catch {
        availableNeighborhoods = [];
      }
    }
    if (!Array.isArray(availableNeighborhoods)) availableNeighborhoods = [];

    // Endpoint PÚBLICO (sem login, usado pelo cardápio online): nunca devolver segredos.
    // ifoodAccessToken/ifoodRefreshToken/ifoodTokenExpiresAt eram espalhados aqui por causa do
    // `...profile` — qualquer um com o domínio do tenant conseguia pegar o token real do iFood
    // daquele cliente. O front nunca lê esses campos; troca por um booleano.
    const {
      ifoodAccessToken,
      ifoodRefreshToken,
      ifoodTokenExpiresAt,
      anotaAiApiKey,
      ...safeProfile
    } = profile as typeof profile & {
      ifoodAccessToken: string | null
      ifoodRefreshToken: string | null
      ifoodTokenExpiresAt: Date | null
      anotaAiApiKey: string | null
    }

    return reply.status(200).send({
      ...safeProfile,
      availableNeighborhoods,
      deliverySectors,
      googleReviewUrl,
      neighborhoodPolicy,
      menuThemePreset,
      menuTheme,
      paymentMethods: publicPayments,
      ifoodConnected: Boolean(ifoodAccessToken),
    })
  } catch (error) {
    console.error('Error fetching public profile:', error)
    return reply.status(500).send({ message: 'Internal server error.' })
  }
}
