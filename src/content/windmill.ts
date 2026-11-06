export interface WindmillChapter {
  id: 'air' | 'blades' | 'axis' | 'slowdown' | 'energy'
  titleZh: string
  titleEn: string
  zh: string
  en: string
  durationMs: number
}

/**
 * A paper pinwheel lesson for children aged about eight.
 * Tilted paper surfaces receive aerodynamic forces with a component around
 * the pin. The lesson describes that rotational effect without torque formulas;
 * this is not a model of electricity generation or all wind turbine aerodynamics.
 */
export const windmillChapters: WindmillChapter[] = [
  {
    id: 'air',
    titleZh: '风是会动的空气',
    titleEn: 'Wind is moving air',
    zh: '风，就是正在移动的空气。我们看不见空气，却能感觉到风轻轻吹过脸颊。',
    en: 'Wind is moving air. We cannot see the air, but we can feel a gentle breeze on our cheeks.',
    durationMs: 10000,
  },
  {
    id: 'blades',
    titleZh: '斜斜的纸叶片',
    titleEn: 'Tilted paper blades',
    zh: '风正对叶轮吹来。从侧面看，来风和中心轴方向一致。纸叶让空气拐弯，空气也推着纸叶。一部分推力让风车绕轴转起来！',
    en: 'In this side view, wind faces the wheel and flows parallel to its pin. Folded paper turns air aside. Air pushes back; part of that push makes the wheel spin.',
    durationMs: 18000,
  },
  {
    id: 'axis',
    titleZh: '围着小轴转圈圈',
    titleEn: 'Round and round the pin',
    zh: '中心的小轴托住风车，叶片能围着它转。风不停地推，风车就继续转动，好像推旋转门。',
    en: 'A little pin holds the wheel in place and lets it turn. The wind keeps pushing it around, like pushing a revolving door.',
    durationMs: 13000,
  },
  {
    id: 'slowdown',
    titleZh: '风停了，慢慢停下来',
    titleEn: 'No wind? Slow down!',
    zh: '风停了，风车不会马上停住。轴上的摩擦和空气的阻力让它越转越慢，最后停下来。',
    en: 'When the wind stops, the pinwheel keeps spinning for a while. Friction at the pin and air resistance slow it down.',
    durationMs: 12000,
  },
  {
    id: 'energy',
    titleZh: '风把能量传过来',
    titleEn: 'Wind passes on energy',
    zh: '原来，风把一部分运动的能量传给了风车！空气在动，叶片受力，风车转圈：这就是能量传递。',
    en: 'The wind passes some of its movement energy to the pinwheel! Air moves, blades get a push, and the wheel spins.',
    durationMs: 12000,
  },
]

export interface WindmillQuestion {
  id: string
  zh: string
  en: string
  options: { id: string; zh: string; en: string }[]
  correctId: string
  explanationZh: string
  explanationEn: string
}

export const windmillQuestions: WindmillQuestion[] = [
  {
    id: 'what-is-wind',
    zh: '风是什么？',
    en: 'What is wind?',
    options: [
      { id: 'moving-air', zh: '正在移动的空气', en: 'Moving air' },
      { id: 'sunlight', zh: '太阳发出的光', en: 'Light from the sun' },
      { id: 'paper-magic', zh: '纸里面的魔法', en: 'Magic inside the paper' },
    ],
    correctId: 'moving-air',
    explanationZh: '答对了！风就是正在移动的空气，它可以给叶片一个推力。',
    explanationEn: 'Yes! Wind is moving air, and it can push the blades.',
  },
  {
    id: 'why-turn',
    zh: '风为什么能让叶片绕轴转？',
    en: 'Why can wind turn the blades around the pin?',
    options: [
      { id: 'pin-pulls', zh: '小轴一直拉着它们', en: 'The pin keeps pulling them' },
      { id: 'turning-push', zh: '风推着倾斜的叶片，一部分推力朝着转圈的方向', en: 'Wind pushes tilted blades, partly around the pin' },
      { id: 'color-power', zh: '颜色给了它们力量', en: 'Their colors give them power' },
    ],
    correctId: 'turning-push',
    explanationZh: '正面吹来的空气被纸叶带向一边，空气也推着纸叶。一部分推力沿着转圈的方向，让叶片绕轴转；小轴托住风车，让它能转动。',
    explanationEn: 'The folded paper turns the incoming air aside, and the air pushes back. Part of that push turns the blades around the pin. The pin supports the wheel and lets it spin.',
  },
  {
    id: 'wind-stops',
    zh: '风停了以后，风车会怎样？',
    en: 'What happens after the wind stops?',
    options: [
      { id: 'faster', zh: '越转越快', en: 'It spins faster and faster' },
      { id: 'forever', zh: '一直转，永远不停', en: 'It spins forever' },
      { id: 'slower', zh: '转一会儿，慢慢停下来', en: 'It spins for a while, then slows to a stop' },
    ],
    correctId: 'slower',
    explanationZh: '风车会继续转一会儿。摩擦和空气阻力会让它慢下来，最后停住。',
    explanationEn: 'It keeps spinning for a while. Friction and air resistance slow it to a stop.',
  },
]

/** Primary education sources used to check the child-friendly explanation. */
export const windmillSources = [
  {
    title: 'NASA Glenn · Factors That Affect Lift',
    url: 'https://www.grc.nasa.gov/WWW/K-12/FoilSim/Manual/fsim0004.htm',
    noteZh: '纸面相对来流的倾斜很重要；弯曲不是产生横向气动力的必要条件。',
  },
  {
    title: 'NASA Glenn · Torque (Moment)',
    url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/torque-moment/',
    noteZh: '力的方向、作用位置和转轴约束共同决定绕轴的转动效果。',
  },
  {
    title: 'Science Buddies · The Power of a Pinwheel',
    url: 'https://www.sciencebuddies.org/stem-activities/strong-wind-science-the-power-of-a-pinwheel',
    noteZh: '纸风车的受风方向影响转速和转向；本动画选择从正面来风的情况。',
  },
  {
    title: 'NOAA · Learning Lesson: Toasty Wind',
    url: 'https://www.noaa.gov/jetstream/global/learning-lesson-toasty-wind',
    noteZh: '风是移动的空气。',
  },
  {
    title: 'Esplora Interactive Science Centre · Feeling Crafty?',
    url: 'https://esplora.org.mt/feeling-crafty/',
    noteZh: '纸风车接住流动的空气，绕一个支点自由旋转；支点摩擦会影响转动。',
  },
  {
    title: 'Montana State University · Land Use Explorers',
    url: 'https://waferx.montana.edu/landuseexplorers-activities.html',
    noteZh: '纸风车把移动空气的能量转成旋转运动。',
  },
]
