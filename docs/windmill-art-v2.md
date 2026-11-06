# 风车科普动画：第二版美术

## 当前第九版：字幕措辞与折痕来风，2026-11-06

第一章改为“风，就是正在移动的空气。我们看不见空气，却能感觉到风轻轻吹过脸颊。”
中英字幕与免费本地AAC配音同步更新，中文6.848秒、英文6.992秒；其余八条音轨未变。
第二章保持原主图和单叶副图，只将代表性来流指向原图亮折痕(u380,v500)，
箭头在折弯处接上偏转。注释随同一折痕移动，来风方向始终与轴平行。
64项相关检查及生产构建通过；桌面与两种手机宽度已核对实际折痕接触、
同步、暂停与回放，独立视觉复查通过。

## 第八版：原主图与单叶副图记录

按用户反馈恢复原来的大幅正面风车与绘本背景。45°视图回到副图位置，
只展示一片红色纸叶；直接复用原始叶轮PNG的红叶轮廓、纸纹和折痕，
不再使用第七版的四片程序纸帆。红叶在浏览器内按颜色和透明度分离，
经浅纵深与45°透视投影呈现，未生成或修改新的图片文件。

副图用一条固定的轴向来风接上短偏转，蓝色表示空气；橙色直箭头明确标注
“推着转的力 / Turning push”，只表示产生转动的切向分量。取消局部转动
圆弧与两个材料点圆环，避免与力混淆。主图和单叶片仍共享同一转角。
手机恢复上方主图、下方解释与副图，第二章尺寸为358×590。

551项测试、TypeScript及生产/PWA构建通过；桌面、390/350px手机及独立
视觉复查通过。已有免费本地配音保持。科学示意、录像及覆盖边界见
`src/components/BladeForceDiagram.REHEARSAL.md`。

## 第七版透视主图记录（历史，已按用户反馈替换）

第二章已改为以三维透视风车为主图，原正面素材缩为明确标注的小参照。
`windmillScene.ts` 用同一台45°偏航、8°俯角的透视相机投影纸叶、轴和来风。
纸叶是有反面、回卷纸角及曲面明暗的实体网格；回卷角收回至18%半径。
轴尾延长到叶片之外，轴标注在整个慢动作中都指向露出的轴端。

三股来风固定在空间中，沿轴从迎风面吹向叶轮。气流先命中实际最前纸面，
再从同一位置沿开放边偏折，最后流到叶轮后方；蓝点连续通过这条路径，
不再有一条脱离来风、跟随红叶转动的曲线。蓝色表示气流，金色只表示转动。
第二章已关闭正面参照上的缩放蓝点，避免两个不同视角同时争抢风向解释。

本轮未生成新图片，既有绘本背景与免费本地Kokoro配音保留。纸叶是定性科普
模型，未做流体仿真或对生成素材的精确三维重建。547项测试、TypeScript和
生产/PWA构建通过；最终桌面及手机关键帧已做独立视觉复查。
完整几何、气流、录像证据及检查边界见
`src/components/BladeForceDiagram.REHEARSAL.md`。

## 第五版美术记录（历史）

2026-11-05 首次美术改版；2026-11-06 当前第五版将第二章左图改为真正的侧面投影，明确展示来风与中心轴平行、迎风面与轴垂直。右图保留正面风车，两图同步同一片红叶的转角。历史上使用内置 **ImageGen** 生成四张原创素材，目前接入原叶轮、草地场景与近景草叶三张，第四张独立纸叶图已停用。本轮未生成新图片，未使用 CLI 或外部图库。科普叙事、双语配音与可交互的风力模型保留，画面继续由 Stageshow 的 Stage 承载。

## 素材与使用方式

| 文件（相对项目根目录） | 用途 |
| --- | --- |
| `public/images/windmill/paper-pinwheel-v2.png` | 透明背景的卷纸叶轮；四片相接的彩色纸叶，保留折痕、纸纹、厚度和自阴影。按铜钉位置对齐旋转中心，中心钉使用固定的 SVG 高光覆盖。 |
| `public/images/windmill/meadow-scene-v2.png` | 暖色晨光、远山和草地的绘本场景；文字区域以浅色遮罩保证阅读，背景轻微移动形成景深。 |
| `public/images/windmill/meadow-foreground-v2.png` | 透明的近景草叶与雏菊；以底部为轴随风轻摆。 |
| `public/images/windmill/red-paper-vane-side-v3.png` | 历史素材，当前页面未使用。单片珊瑚红卷纸叶的斜侧面，1619 × 971 RGBA、真实透明背景；保留文件与原提示词，作为第三版的来源记录。 |

风车木杆、转动圆弧、中心轴引线仍由 SVG 绘制。右侧正面图继续使用 `paper-pinwheel-v2.png`，图片边界为 `x=-206, y=-207.65, width=420, height=420`，红叶材料标记点为 `(-84, -76)`。左侧不是压扁或倾斜这张栅格图，而是用 `bladePaperPoint` 构造示意性的卷纸曲面，再按真正的侧面相机投影。四片叶子提供叶轮侧立的背景，其中红叶高亮；相同的白金色标记对应同一片纸叶和同一转角。两个视图由父级同一次绘制回调传入转角与章节时间，局部图没有自己的时钟或动画帧循环。

侧面相机沿叶轮平面内的横向看过去，使用 `projectBladeSidePoint({x,y,z}) = {x:-z,y:y}`。中心轴在画面中水平，叶轮参考平面竖立；空气沿轴从左向右，正对叶轮迎风面流来。来风的“正面”由叶轮及其中心轴定义，不由观众站在哪里定义。空气接近红纸叶后，向转动切线的反方向偏转；橙色箭头只表示让叶片绕轴转的那部分推力。正面图中的逆时针圆周运动，在侧面投影中表现为红叶标记的上下运动，侧面不再画平面内的逆时针圆弧。

当前曲面与气流是定性的科普示意，不是真实纸叶的精确三维重建，也没有从生成图片计算流体仿真。仅“垂直于轴”还不足以解释转动：指向轴心的径向力也垂直于轴，却不能产生绕该轴的力矩；此处展示切向分量。科学依据见 [NASA 的空气偏转与空气动力说明](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bernoulli-and-newton/)及[力矩说明](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/torque-moment/)。

按这张叶轮的卷口朝向，正面来风时，大图的实际旋转与金色圆弧统一为逆时针；这不代表所有折法的纸风车都逆时针转。第一章的流线说明空气在移动；其他章节和实验仍使用面向叶片缩小、淡出的透视蓝点，标签统一为“风正对叶轮吹来”，不再使用观众相对方向。所有运动均跟随播放、暂停、视口可见性与减少动态效果设置。切换风力仍由原有加速、惯性和摩擦模型控制转速。

手机采用独立构图，叶轮和景物在上、双语解释与侧面示意图在下；第二章使用 358 × 630 的独立 Stage，其他章节保持原尺寸。第二章进入时从原姿态用 1.5 秒沿逆时针方向对齐，停留至第 4 秒，再于 4—14 秒同步转动 48°，保留终态至 18 秒结束；蓝色气流在最后阅读停留中继续随父级时钟运动。左图标注“侧面看 / Side view”，大图标注“正面 · 慢动作 / Front · Slow motion”；减少动态效果时使用正面静态图标签与完成后的静帧。

第二章阅读时间为 18 秒，五章基本时长合计 65 秒；实际播放还会等待当前配音结束。新版两条文案的实际本地 AAC 时长分别为中文 13.424 秒、英文 13.071 秒。

## 最终生成提示词

### 1. 折纸叶轮

设置：`transparent_background: true`。

```text
Use case: scientific-educational. Asset type: isolated animated rotor asset for a high-end interactive children's science film, age 8. Generate ONE extremely recognizable classic handmade PAPER PINWHEEL ROTOR, viewed precisely straight on, centered at the exact image center, on a truly transparent background. The four broad curved overlapping paper vanes are folded from a single square sheet, their alternating corners curled naturally into the center, with visible connected folded paper, a tiny flush circular brass pin exactly at the center, and a beautifully rounded flowing silhouette. It must unmistakably look like a real folded toy pinwheel, not four detached triangles, not a propeller or fan, no sharp detached fins. Four pleasing rich but soft colors: terracotta coral, saffron golden yellow, sea-glass teal, and sky blue. Premium handcrafted paper-craft 3D render, delicate cotton paper grain, believable fold thickness and gently rolled edges, subtle highlights and self-shadows that reveal volume. Entire rotor fully visible with 10 percent transparent margin, wheel fills 80 percent of square canvas. Strong beautiful material detail but clean at a small screen size. No pole, no stand, no landscape, no people, no letters, no labels, no border, no graphic arrows. Do not add a shadow outside the object. Composition must remain balanced when the entire image is rotated smoothly around its center.
```

### 2. 草地场景

设置：`transparent_background: false`。

```text
Use case: illustration-story. Asset type: wide environmental background plate for a premium interactive children's science animation about a paper pinwheel, no subject painted in. A beautiful tactile miniature countryside built from softly sculpted paper and natural fibers, high-end art-directed 3D illustration with an editorial children's science museum feeling, warm morning sunlight from upper left, airy pale ivory sky occupying 70 percent of the composition, a few very soft distant cream clouds, gentle misty sage hills at the horizon in the bottom 25 percent, detailed layered grasses and tiny wildflowers concentrated near the lower left and lower right corners, delicate paper-cut leaves at the extreme foreground corners, subtle soft shadows, a winding ochre path on the right leading to a small open clearing at 65 percent across and 90 percent down where an animated pinwheel on a wooden stick will be composited later. The clearing must have a calm ground plane for a contact shadow. Color palette: sophisticated ivory, sage and eucalyptus greens, ochre gold, very restrained terracotta accents. Crisp crafted materials in the foreground and atmospheric depth in the distance, no cartoon outlines, no plastic toys, no excessive cute elements, no digital glowing effects. Wide cinematic composition, keep left 45 percent mostly light and very quiet for dark bilingual typography and blue airflow illustration; keep the right middle open for the main animated wheel, avoid busy elements behind that future wheel. No text, no lettering, no UI, no border, no actual pinwheel or wind turbine, no buildings, no people, no animals. The result should feel sunny, poetic and expensive but still immediately inviting to an eight-year-old.
```

### 3. 近景草叶

设置：`transparent_background: true`。

```text
Use case: illustration-story. Asset type: transparent foreground parallax layer for the same premium children's science countryside animation. A single small graceful cluster of meadow grasses, two slim curled eucalyptus leaves and one tiny white daisy, all growing from the lower-left corner, isolated on a completely transparent background. Handmade sculpted paper and fine natural-fiber texture, very tactile premium 3D editorial illustration, muted sage and olive greens, tiny warm ivory daisy with ochre center, gentle warm morning light from the upper left, subtle self shadows. Low horizontal composition, the cluster occupies the bottom left and fades in height toward the right, tallest grass no more than half the canvas height. Natural curved airy shapes, nothing spiky or dense. The roots meet the bottom edge so this layer can sit along the bottom of a scene and gently sway at its base. No ground plane, no soil mound, no cast shadow outside the foliage, no sky, no pinwheel, no animals, no people, no letters or words, no frame. Clean alpha edges.
```

### 4. 单片卷纸叶，2026-11-06（历史版本，当前未使用）

设置：`transparent_background: true`；以内置 ImageGen 引用原始彩色叶轮作为材质和风格参考。生成原文件：`/Users/lixuhong/.codex/generated_images/01a1ae40-1e07-73f3-a8c9-7305ce34506d/exec-ad4638e4-45aa-43f5-b5b3-79f276468f56.png`，复制保存为 `public/images/windmill/red-paper-vane-side-v3.png`。第三版曾接入；第四版改用原叶轮的斜投影，第五版使用程序构造的卷纸曲面侧投影，此文件均未被引用。以下保留原始提示词，不作为当前气流方向的科学依据。

```text
Use case: scientific-educational.
Asset type: one transparent PNG paper-vane close-up asset for an interactive children's science animation, displayed about 300 by 180 CSS pixels.
Primary request: generate ONE isolated coral-red paper pinwheel vane, viewed at a clear oblique side angle, a broad thin handmade folded paper scoop with a gently curled shallow concave surface.
Input image: the attached complete four-color pinwheel is ONLY a material and art-style reference. Match its coral-red cotton paper grain, soft natural highlights, thin folded edges, and premium handcrafted paper-craft 3D illustration. Do not reproduce the full pinwheel.
Subject and orientation: a single generous wide sheet of coral-red paper curls gently into a shallow scoop. Its broad main surface slopes from upper-left toward lower-right in the image, bending gradually rather than making a sharp crease; the near rim curls slightly toward the camera so the concavity and thin edge are visible. The left-facing open side of the shallow concavity is easy to see. Imagine invisible air arriving horizontally from the left and following the inner paper surface toward the lower-right; leave that path visually open. Show a real piece of lightweight paper with a broad visible face, not a narrow ribbon or bar. A modest fold seam and realistic paper thickness reinforce that this is part of a folded toy pinwheel.
Composition/framing: low wide horizontal composition, the complete paper vane entirely visible with comfortable transparent margin, fills about 75 percent of the canvas, centered. Beautiful softly shaded volume, clean simple silhouette, unmistakable at small display size.
Lighting/mood: gentle warm light from upper left, subtle self shadows only, no cast shadow on anything outside the paper. Children’s science museum quality, tactile and inviting.
Constraints: genuine transparent alpha background, clean anti-aliased edges. Exactly one coral-red paper vane only. No full rotor, no other colored vanes, no pole, no hub, no brass pin, no hands, no background, no ground, no arrows, no airflow, no lines, no text, no labels, no frame, no external cast shadow.
Avoid: brown strips, wooden blades, propeller blades, metal, plastic, dense accordion folds, sharp spikes, tubes, deep bowls or full loops.
```

## 验证

2026-11-05 美术版的历史验证：470 项测试及生产构建通过；Chrome 桌面和 390px 手机视口逐章检查，原三张素材加载正常，无页面异常及横向溢出。播放、暂停、配音切换、风力实验、页面离开、音频失败降级及减少动态效果检查通过。这些记录不等同于 2026-11-06 简化后的新图已经完成视觉验证。

2026-11-06 第三版的历史验证：两条实际配音按当时文案更新；472 项测试和生产/PWA 构建通过。Chrome 在 1120/390/350px 检查了逆时针转动、实验和无风滑行、暂停/回放、减少动态效果静帧、窄屏边界与页面异常。Stageshow 桌面和手机状态图的布局 gate 均输出 `rehearsal passed`；录制时存在采样间隙，运动报告仍为 `inconclusive`。这些结果对应已停用的独立纸叶演示，不验证当前第四版的空间关系和同步转动。

2026-11-06 第四版的历史验证：全部491项测试和最终生产/PWA构建通过，其中19项几何回归验证了当时的斜投影、轴向来风、反向切向偏转和章节姿态连续性。Chrome在1120/390/350px检查过同图、同转角、暂停/回放、减少动态效果静帧和窄屏边界；392帧两图转角零差异。第四版自己的桌面和手机Stageshow布局gate均输出`rehearsal passed`；运动报告因采样间隙仍为`inconclusive`。这些记录对应已被替换的斜视构图，不验证第五版的真正侧面投影。

第五版的历史验证：全部503项测试和最终生产/PWA构建通过。Chrome在1120/390/350px核对侧视图、边界、暂停/回放、减少动态效果静帧和页面异常；392帧两图共享转角零差异，入射气流的水平段纵向变化为零。独立视觉复查确认轴与来风水平平行、叶轮侧立、正侧投影与箭头方向一致、双语文字无裁切。该版桌面和手机Stageshow布局gate均输出`rehearsal passed`；运动报告仍因采样间隙为`inconclusive`（桌面10段、手机2段），未宣称连续逐帧覆盖通过。未检查实体iPad/Safari。

第六版的历史验证：左图改为45°斜视、15°俯角，叶片、轴、来风和推力使用统一三维投影；原有图片素材和免费本地配音保留。510项测试通过，最终生产构建及60项风车专项检查通过。Chrome在1120/390/350px核对了边界、轴向来风、两图同步和暂停/回放，392帧转角零差异。独立视觉复查提出的字幕重叠及标注对比度问题已修正并复查。桌面和手机Stageshow布局gate均输出`rehearsal passed`；运动报告仍为`inconclusive`（桌面17段采样间隙，最终手机1段），不代表连续逐帧验证。用户之后指出风向和45°关系仍不够清楚，第七版因此重做主次构图、实体纸叶和固定入流。这些历史结果不验证当前第七版。

本轮关键帧与浏览器检查脚本位于 `/private/tmp/windmill-rehearsal/`；完整科学和演出说明见 `src/components/WindmillStage.REHEARSAL.md`。
