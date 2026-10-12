# 3D Configurator Studio

If i give you a glb model file, by using that 3d model
can you build a 3d configurator with some features in real 3d environment .
features like(which can be accessbile by ccliking btn )
zoom in zoom out
scale measures
grid floor
and other some features which should be there for 3d viewer configuratoir.
also use some fabrics for sofa and materials for legs too. so that user can chnge that too
and thiese materials and fabrics should be applied correctly on model respectively

this is the glb file, create whole 3d configurtor using this model
and implemnet all the things which i stated and all other features which you think should be there in 3d configurator viewer
also ui should look premium but not ai generated.
no hovers, no zoom in zoom out on hover
no use of gradient color.
use solid colors. ui overall should look good


```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy to Vercel

The production build uses Nitro's Vercel preset. To deploy:

1. Push the repository to GitHub and import it in the [Vercel dashboard](https://vercel.com/new).
2. Select the repository and keep the project root as the repository root.
3. Use the detected npm settings, or set the build command to `npm run build`. No output directory override or environment variables are required.
4. Deploy, then open the HTTPS deployment URL on a phone and test the configurator and AR flow.
5. Add a custom domain in **Project Settings → Domains** if desired. QR links use the current site URL, so deployed QR codes resolve to the public Vercel/custom domain.

Vercel creates preview deployments for branches and production deployments from the configured production branch (normally `main`).
