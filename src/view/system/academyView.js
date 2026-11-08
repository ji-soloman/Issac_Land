/**
 * 学派系统：场上存在建造完成的【学院区/特区】（REGION.category.academy === true 的已完工地块）
 * 时解锁"学派"入口。玩家先从全部学派种类里选择一个（一旦选择不可更换——目前一名玩家只能
 * 拥有一个学派，"学完全部学派"是后续奇观等系统才会解锁的能力，见 storage 设计说明），
 * 再依次选择/升级该学派下的分支（至多4条）。
 *
 * 重要：这个解锁判断是"实时"的，不是"曾经满足过就永久解锁"——一旦场上已完工的
 * 学院区/特区数量降到 0（被拆除），学派的所有功能（包括继续升级已经选好的分支）都会
 * 立刻锁住，直到重新建成学院区/特区为止。这是为了避免"先临时多建几个学院区，一口气
 * 选满/升好分支，再拆掉学院区回收资源"这种利用建造/拆除时间差绕过限制的打法。
 * 这个规则在两处生效：military_ui.js 里"学派"菜单卡片的 filter（决定整个入口能不能
 * 点开），以及本文件 createBranchCard 里升级按钮的 districtCount 判断（哪怕入口本身
 * 未来被改成可以一直打开，已解锁分支的升级也照样会被锁住）。
 *
 * 存档结构（存在 saveData.academy 里）：
 *   saveData.academy = {
 *     schools: {
 *       [schoolKey]: {
 *         categories: { [categoryKey]: level }  // level 从 1 开始（选择分支即为1级），
 *                                                 // 未出现在这里 = 该分支尚未选择
 *       }
 *     }
 *   }
 * 之所以从一开始就用"多学派并存"的结构（schools 是个字典，不是单个 school 字段），
 * 是为了让未来"解锁其他学派"的系统（奇观等）不需要迁移存档——那套系统只需要允许
 * schools 字典里出现第二个 key，这里的规则（下面 activeSchoolKey 等取值逻辑）到时候
 * 再调整成不再"只认第一个学派"即可，存储本身不用改。
 * 技能是否解锁不需要单独记录：分支的当前 level 就决定了它解锁了哪些技能
 * （academy_skill.js 里 category.skill[等级] <= 当前 level 的技能都算解锁）。
 *
 * 分支等级本身不设上限，可以一直花文化升下去（消耗公式仍然是 10 * 2^(level-1)，
 * 逐级翻倍），只是 academy_skill.js 里配置到的技能就那么多——超过配置的最高等级
 * 之后继续升级只是单纯涨等级数字，不会再解锁新技能。点击"升级"按钮会先弹出一个
 * 二次确认弹窗（showUpgradeConfirm），确认消耗后才真正调用 upgradeCategory 执行。
 * 分支卡片上不再罗列已解锁的全部技能，改成一个"查看技能"入口（已解锁/未解锁的分支
 * 都能点，方便玩家在选之前先看看整条技能线值不值得选），点击后打开
 * AcademySkillProgressViewer（本文件末尾）——横向可滚动地展示从 1 级到配置表最高
 * 等级的完整技能线，一级一列，列间用箭头连接。
 */
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { saveSystem } from '../../system/saveSystem.js';
import { game } from '../../system/function.js';
import { military } from '../../system/military.js';
import { REGION } from '../../data/region.js';
import { ACADEMY_SKILL } from '../../data/academy_skill.js';
import { MILITARY_SKILL } from '../../data/military_skill.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';

// ── 兵组"携带技能 / 已学习技能"扩展 ──────────────────────────────────────
// 兵组存档（saveData.military[soldierId]）原本只有 ability（当前携带、会在战斗里
// 用出来的技能），没有区分"学会了但没带"和"当前携带"。这里补一个 learnedSkills
// （已解锁/已学习的技能池，格式和 ability 一样是 {skillKey: true} 的字典）：
//   - 兵种自带的初始技能一直写在 ability 里（system/military.js::addSoldier），
//     不需要额外迁移数据——hasLearnedSkill 对 learnedSkills 缺失的情况会兜底去查
//     ability，天生自带的技能一样算"已学会"。
//   - 通过学派技能"学习"功能新学会的技能，会加进 learnedSkills；如果当前携带的
//     主动技能数量还没到上限（MAX_CARRIED_SKILLS），顺便自动写进 ability 携带。
//   - 后续"从已学习技能里更换当前携带技能"的功能暂不实现，这里只把数据结构
//     （carried=ability / learned=learnedSkills 两个独立字段）搭好。
//
// 之所以在这里用"运行时给已导入的 military 对象挂新方法"，而不是直接编辑
// system/military.js 文件：项目里 military.js 这个路径同时对应两份不同的文档
// （system 目录下的工具类，和 data 目录下的 MILITARY 菜单注册表），直接按路径
// 写文件有覆盖到另一份同名文档的风险——military_ui.js 扩展 MILITARY 注册表时
// 也是用的这个办法，这里保持一致，等价但更安全。加存在性判断避免本模块被
// 多次加载时重复赋值（无副作用，但没必要）。
const MAX_CARRIED_SKILLS = 4; // 兵组同时能"携带"的主动技能数量上限，和 militaryUnitView.js
// 技能宫格 2x2 布局（_buildSkillGrid 里的 slice(0,4)）保持一致

if (!military.countCarriedActiveSkills) {
  military.countCarriedActiveSkills = function (soldier) {
    return Object.keys(soldier?.ability ?? {}).filter(k => {
      if (!soldier.ability[k]) return false;
      return (MILITARY_SKILL[k]?.type ?? 'initiative') === 'initiative';
    }).length;
  };
}

if (!military.hasLearnedSkill) {
  military.hasLearnedSkill = function (soldier, skillKey) {
    if (!soldier) return false;
    return !!(soldier.learnedSkills?.[skillKey] ?? soldier.ability?.[skillKey]);
  };
}

// 技能 key -> {schoolKey, catKey, level} 的反查表，懒加载并缓存一次（ACADEMY_SKILL
// 是静态配置表，运行时不会变）。用来支持"学习技能有前置要求"这条规则：
// 想学某个分支的 N 级技能，必须已经学过（不要求当前携带）同一学派同一分支里
// 任意一个 N-1 级技能；1 级技能没有前置，可以直接学。
let _skillLevelInfoCache = null;
function getSkillLevelInfo(skillKey) {
  if (!_skillLevelInfoCache) {
    _skillLevelInfoCache = {};
    for (const [schoolKey, school] of Object.entries(ACADEMY_SKILL ?? {})) {
      for (const [catKey, category] of Object.entries(school?.category ?? {})) {
        const skillMap = category?.skill ?? {};
        for (const [lvStr, keys] of Object.entries(skillMap)) {
          const level = Number(lvStr);
          for (const key of keys ?? []) {
            _skillLevelInfoCache[key] = { schoolKey, catKey, level };
          }
        }
      }
    }
  }
  return _skillLevelInfoCache[skillKey] ?? null;
}

if (!military.meetsSkillPrereq) {
  /**
   * 兵组是否满足学习 skillKey 的前置条件。UI（showLearnUnitPicker）和数据层
   * （learnSkill）两处都会调用这个方法，UI 只是提前把不满足条件的兵组灰掉，
   * 真正兜底拦截的判断在 learnSkill 里。
   */
  military.meetsSkillPrereq = function (soldier, skillKey) {
    const info = getSkillLevelInfo(skillKey);
    if (!info || info.level <= 1) return true; // 1 级技能，或者查不到所属分支/等级（配置异常兜底），不设前置
    const prevLevelKeys = ACADEMY_SKILL?.[info.schoolKey]?.category?.[info.catKey]?.skill?.[info.level - 1] ?? [];
    return prevLevelKeys.some(k => military.hasLearnedSkill(soldier, k));
  };
}

if (!military.learnSkill) {
  /**
   * 让指定兵组"学习"一个技能：加入 learnedSkills（已解锁技能池），不会覆盖或移除
   * 任何已有技能。如果该兵组当前携带的主动技能数量还没到 MAX_CARRIED_SKILLS，
   * 顺便自动写进 ability 携带；已经满了的话只加入已学会的池子，不会顶掉正在
   * 携带的其它技能。学习前会检查 meetsSkillPrereq（必须先学过同分支上一级的
   * 任意技能），不满足时返回 prereqMissing:true、不做任何修改。返回
   * { ok, alreadyLearned, autoEquipped, prereqMissing }，调用方负责 saveSystem.save()。
   */
  military.learnSkill = function (saveData, soldierId, skillKey) {
    const soldier = saveData?.military?.[soldierId];
    if (!soldier) return { ok: false, alreadyLearned: false, autoEquipped: false };

    if (!military.meetsSkillPrereq(soldier, skillKey)) {
      return { ok: false, alreadyLearned: false, autoEquipped: false, prereqMissing: true };
    }

    soldier.learnedSkills ??= {};
    soldier.ability ??= {};

    const alreadyLearned = !!(soldier.learnedSkills[skillKey] || soldier.ability[skillKey]);
    soldier.learnedSkills[skillKey] = true;

    let autoEquipped = false;
    if (!soldier.ability[skillKey] && military.countCarriedActiveSkills(soldier) < MAX_CARRIED_SKILLS) {
      soldier.ability[skillKey] = true;
      autoEquipped = true;
    }

    return { ok: true, alreadyLearned, autoEquipped };
  };
}

// 背景图纹理 key（在 gameScene.js 的 preload 里加载 assets/background/academy.jpg）
const BG_IMAGE_KEY = 'academy_bg';

// 学派专用 UI 素材（在 gameScene.js 的 preload 里加载 assets/ui_academy/ 下的图）：
// 左上角标题牌、右上角退出按钮、分支卡片的已解锁/未解锁底板
const HEADER_IMAGE_KEY = 'academy_header';
const CLOSE_IMAGE_KEY = 'academy_close';
const UNLOCKED_PANEL_KEY = 'academy_unlocked_panel';
const LOCKED_PANEL_KEY = 'academy_locked_panel';

// 通用"确认/未确认"按钮底板（assets/ui/confirm.png、unconfirm.png），升级/选择分支
// 这类操作按钮统一用这一对素材：可点击时用 confirm.png，不可点击/终止态用 unconfirm.png
const BTN_CONFIRM_KEY = 'btn_confirm';
const BTN_UNCONFIRMED_KEY = 'btn_unconfirmed';

// 浅色主题配色——不再用黑金风格（深色底+金色文字），改成"背景图+白色遮罩"的浅色调，
// 所有文字颜色统一从这里取，方便整份文件保持一致，以后要整体调整也只改这一处。
// cardBgHex/cardBgAlpha/cardBorderHex 只在 UNLOCKED_PANEL_KEY / LOCKED_PANEL_KEY 素材
// 还没加载到时作为兜底样式使用，正常情况下卡片背景用的是素材图片，不会用到这几个值。
const THEME = {
  textPrimary: '#2b2b2b',    // 主要文字（标题、卡片名称），替代原来的白色
  textSecondary: '#6b6b6b',  // 次要/说明文字，替代原来的浅灰 #aaaaaa / #cccccc
  textDisabled: '#999999',   // 禁用态文字，替代原来的 #888888
  textOnButton: '#ffffff',   // 叠在 confirm/unconfirmed 按钮底板上的文字，统一用白色
  accent: '#3a6ea5',         // 强调色（等级数字、当前学派名等），替代原来的金色 #ffd700
  accentHex: 0x3a6ea5,
  success: '#2f7d4f',        // 可执行/肯定状态文字（未用到按钮素材时的兜底文字色）
  danger: '#c0392b',         // 警告/不可用原因文字，红色在浅色背景上依旧清晰，不用改
  cardBgHex: 0xffffff,       // 卡片底色兜底（素材缺失时）：白色半透明
  cardBgAlpha: 0.92,
  cardBorderHex: 0xd0d0d0,   // 卡片描边兜底：浅灰
};

// 分支卡片美术（unlocked_panel.png / locked_panel.png）自带一条横向分割线（约在卡片
// 从上往下 42% 的位置），上半部分放"名字 + 等级"，下半部分放灰色说明文字（技能列表 /
// 未解锁提示）。这个比例是照着美术图估的，如果以后换了新的分割线位置，改这一个值即可。
const CARD_DIVIDER_Y_RATIO = 0.42;

// ── 共用的小工具函数：AcademyViewer 和 AcademySkillProgressViewer 都会用到，
// 抽成模块级函数避免两个类各写一份 ──────────────────────────────────────

/**
 * 统一的文字创建入口：默认带上 padding.top，修复部分中文字体在 Phaser 里顶部
 * 被裁掉一截、显示不全的问题（Canvas 文本测量的行高比实际字形边界紧，不加
 * 顶部内边距会把上半部分裁掉）。这份文件里所有 add.text 都应该走这个函数，
 * 不要再直接调用 scene.add.text。
 */
function themedText(scene, x, y, content, style = {}) {
  const { padding, ...rest } = style;
  return scene.add.text(x, y, content, {
    padding: { top: 4, ...(padding ?? {}) },
    ...rest,
  });
}

/**
 * 操作按钮（选择分支 / 升级 / 学习 等）：用 confirm.png（可点击）或 unconfirm.png
 * （不可点击/终止态）铺底，文字统一白色。素材缺失时退回原来的纯色矩形按钮。
 * 返回按钮背景/文字对象，方便调用方按需要绑定交互事件。
 */
function buildActionButton(scene, container, x, y, btnWidth, btnHeight, label, enabled) {
  const textureKey = enabled ? BTN_CONFIRM_KEY : BTN_UNCONFIRMED_KEY;
  if (scene.textures.exists(textureKey)) {
    const btnBg = scene.add.image(x, y, textureKey).setDisplaySize(btnWidth, btnHeight);
    const btnTxt = themedText(scene, x, y, label, {
      fontSize: '15px', color: THEME.textOnButton, fontStyle: 'bold',
    }).setOrigin(0.5);
    if (!enabled) {
      // 不可点击的按钮（unconfirm.png）整体再灰化一点点，和可点击的 confirm.png 拉开区分度
      btnBg.setAlpha(0.8);
      btnTxt.setAlpha(0.8);
    }
    container.add([btnBg, btnTxt]);
    return { btnBg, btnTxt };
  }
  const btnBg = scene.add.rectangle(x, y, btnWidth, btnHeight, enabled ? 0x3a6ea5 : 0xe0e0e0);
  const btnTxt = themedText(scene, x, y, label, {
    fontSize: '15px', color: enabled ? THEME.textOnButton : THEME.textDisabled, fontStyle: 'bold',
  }).setOrigin(0.5);
  container.add([btnBg, btnTxt]);
  return { btnBg, btnTxt };
}

// ── 数据/规则辅助：导出给 military_ui.js 的菜单解锁判断复用 ──────────────

/** 统计存档里已建成的"学院区/特区"数量（任意 REGION.category.academy === true 的已完工地块，建造中的不算） */
export function countAcademyDistricts(saveGrids) {
  if (!saveGrids) return 0;
  let count = 0;
  for (const gn of Object.values(saveGrids)) {
    const regionKey = gn?.region;
    if (regionKey && REGION?.[regionKey]?.category?.academy === true) count++;
  }
  return count;
}

/** 某个分支当前等级（0 = 尚未选择这条分支） */
export function getCategoryLevel(saveData, schoolKey, categoryKey) {
  return saveData?.academy?.schools?.[schoolKey]?.categories?.[categoryKey] ?? 0;
}

/** 某个分支的最高等级：取该分支技能表里出现过的最大等级 key（不是技能数量——比如飓风之灵只在4级有技能，最高等级仍然是4） */
export function getCategoryMaxLevel(schoolKey, categoryKey) {
  const skillMap = ACADEMY_SKILL?.[schoolKey]?.category?.[categoryKey]?.skill ?? {};
  const levels = Object.keys(skillMap).map(Number);
  return levels.length > 0 ? Math.max(...levels) : 0;
}

/** 分支从 level 升到 level+1 所需文化：10 * 2^(level-1)，即 1→2 消耗10，2→3消耗20，3→4消耗40，逐级翻倍 */
export function getUpgradeCost(level) {
  return 10 * Math.pow(2, Math.max(0, level - 1));
}

export class AcademyViewer {
  constructor(scene, saveData, name) {
    this.scene = scene;
    this.saveData = saveData;
    this.title = name || '学派';
    this.mainContainer = null;
    // 正在处理中的分支升级请求（防止 addAction 的异步回调还没返回时重复点击升级按钮）
    this._pendingUpgradeKeys = new Set();
    // 正在"浏览"哪个学派的分支（null 表示查看玩家自己真正选择的学派）；
    // 是否处于"选择/浏览学派列表"这一层界面。这两个字段都是纯临时的展示状态，
    // 不写进存档——每次重新打开学派面板都会新建一个 AcademyViewer 实例，字段
    // 自动回到默认值，天然满足"点进去默认还是保持当前学院"的要求。
    this.viewingSchoolKey = null;
    this._showSchoolList = false;
    this.create();
  }

  /** 见文件顶部的模块级 themedText——所有 add.text 都应该走这个方法 */
  _text(x, y, content, style = {}) {
    return themedText(this.scene, x, y, content, style);
  }

  create() {
    const { width, height } = this.scene.scale;

    this.mainContainer = this.scene.add.container(0, 0).setDepth(1100);

    // 背景图：等比缩放铺满整个界面（CSS background-size: cover 的效果），居中裁掉超出
    // 屏幕比例的部分，和 battleSystem.js 战斗背景的做法一致；素材还没加载到时退回纯色兜底
    if (this.scene.textures.exists(BG_IMAGE_KEY)) {
      const bgImage = this.scene.add.image(width / 2, height / 2, BG_IMAGE_KEY);
      const coverScale = Math.max(width / bgImage.width, height / bgImage.height);
      bgImage.setScale(coverScale);
      this.mainContainer.add(bgImage);
    }

    // 20% 不透明度的白色遮罩盖在背景图上方，让背景图更透一些、整体依然是浅色调——
    // 不再是黑金风格，后面所有卡片/按钮/文字的颜色都统一改成了适合浅色背景的配色（见 THEME）
    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0.2);
    bg.setInteractive(); // 阻挡穿透，点击不会漏到下层的军事菜单
    this.mainContainer.add(bg);

    this.createHeader();
    this.createCloseButton();

    this.titleText = this._text(width / 2, 46, this.title, {
      fontSize: '32px',
      color: THEME.textPrimary,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.mainContainer.add(this.titleText);

    this.contentContainer = this.scene.add.container(0, 0);
    this.mainContainer.add(this.contentContainer);

    this.render();
  }

  /**
   * 左上角标题牌（assets/ui_academy/header.png），纯装饰，素材缺失时不放任何东西兜底。
   * 只按目标高度等比缩放（setScale 而不是 setDisplaySize 两个值分别拉伸），避免图片变形。
   */
  createHeader() {
    if (!this.scene.textures.exists(HEADER_IMAGE_KEY)) return;
    const header = this.scene.add.image(0, 0, HEADER_IMAGE_KEY).setOrigin(0, 0);
    const targetHeight = 84;
    header.setScale(targetHeight / header.height);
    this.mainContainer.add(header);
  }

  /**
   * 右上角退出按钮（assets/ui_academy/close.png），素材缺失时退回原来的文字按钮。
   * 同样只按目标高度等比缩放，保持素材原始宽高比，不拉伸变形。
   */
  createCloseButton() {
    const { width } = this.scene.scale;

    if (this.scene.textures.exists(CLOSE_IMAGE_KEY)) {
      const closeBtn = this.scene.add.image(width, 0, CLOSE_IMAGE_KEY).setOrigin(1, 0);
      const targetHeight = 60;
      closeBtn.setScale(targetHeight / closeBtn.height);
      closeBtn.setInteractive({ useHandCursor: true });
      closeBtn.on('pointerover', () => closeBtn.setAlpha(0.85));
      closeBtn.on('pointerout', () => closeBtn.setAlpha(1));
      closeBtn.on('pointerdown', () => this.destroy());
      this.mainContainer.add(closeBtn);
      return;
    }

    const closeBtn = this._text(width - 50, 40, '退出', {
      fontSize: '20px', backgroundColor: '#cc0000', color: THEME.textOnButton, padding: { x: 10, y: 5, top: 4 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.destroy();
      });
    this.mainContainer.add(closeBtn);
  }

  /**
   * "查看技能"入口：灰色文字（不是图片按钮），点击打开 AcademySkillProgressViewer。
   * 已解锁和未解锁的分支都能点——AcademySkillProgressViewer 里的当前等级直接取
   * getCategoryLevel，未选择这条分支时等级是 0，查看器会自动把所有等级列都显示成
   * "未解锁"状态，不需要额外传参区分。
   */
  _addViewSkillLink(container, y, schoolKey, catKey, categoryName) {
    const link = this._text(0, y, '查看技能 >', {
      fontSize: '15px', color: THEME.textSecondary, fontStyle: 'bold',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => link.setColor(THEME.accent))
      .on('pointerout', () => link.setColor(THEME.textSecondary))
      .on('pointerdown', () => {
        new AcademySkillProgressViewer(this.scene, this.saveData, schoolKey, catKey, categoryName);
      });
    container.add(link);
    return link;
  }

  /**
   * 卡片底板：优先用素材图片铺满整张卡片，素材缺失时退回半透明白色矩形+描边。
   * container 是卡片自己的容器（局部坐标系原点在卡片中心），直接把底板加进去即可。
   */
  _addCardPanel(container, cardWidth, cardHeight, textureKey) {
    if (this.scene.textures.exists(textureKey)) {
      const panel = this.scene.add.image(0, 0, textureKey).setDisplaySize(cardWidth, cardHeight);
      container.add(panel);
      return;
    }
    const bg = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, THEME.cardBgHex, THEME.cardBgAlpha);
    const border = this.scene.add.rectangle(0, 0, cardWidth, cardHeight).setStrokeStyle(2, THEME.cardBorderHex);
    container.add([bg, border]);
  }

  /** 见文件顶部的模块级 buildActionButton */
  _addActionButton(container, x, y, btnWidth, btnHeight, label, enabled) {
    return buildActionButton(this.scene, container, x, y, btnWidth, btnHeight, label, enabled);
  }

  /** 存档里的 academy.schools 字典，惰性初始化 */
  get schools() {
    this.saveData.academy ??= { schools: {} };
    this.saveData.academy.schools ??= {};
    return this.saveData.academy.schools;
  }

  /**
   * 当前生效的学派 key；未选择时为 null。
   * 目前规则是"一名玩家只能有一个学派"，所以这里直接取字典里唯一的 key；
   * 后续如果奇观等系统解锁了多学派并存，这个 getter（以及下面选择学派时的
   * "已选择过就不能再选"判断）需要按那套系统的规则重新设计，但 schools 字典
   * 本身的存储结构已经支持多学派，不需要迁移数据。
   */
  get activeSchoolKey() {
    const keys = Object.keys(this.schools);
    return keys.length > 0 ? keys[0] : null;
  }

  render() {
    this.contentContainer.removeAll(true);
    const schoolKey = this.activeSchoolKey;
    if (!schoolKey) {
      // 还没选过学派：只有"选择学派"这一种界面，没有浏览模式
      this.renderChooseSchool(false);
      return;
    }
    if (this._showSchoolList) {
      // 已经选过学派，但玩家点了"查看其他学院"——展示只读的学派列表
      this.renderChooseSchool(true);
      return;
    }
    // viewingSchoolKey 为 null 表示当前没有在浏览别的学派，显示自己真正选择的学派；
    // 不为 null 时显示正在浏览的那个学派（可能等于自己的学派，也可能是别的学派）
    const viewKey = this.viewingSchoolKey ?? schoolKey;
    this.renderBranches(viewKey, viewKey === schoolKey);
  }

  // ── 第一步：选择学派 ──────────────────────────────────────────────

  /**
   * @param {boolean} browseMode 是否是"已经选好学派之后，回来查看其他学派"的只读浏览模式。
   * false（默认）是最初"从未选择过学派"时的一次性选择流程，点击卡片会调用 chooseSchool
   * 永久绑定学派；true 时点击卡片只是切换 viewingSchoolKey/_showSchoolList，绝不会调用
   * chooseSchool，也就永远不会二次绑定学派。
   */
  renderChooseSchool(browseMode = false) {
    const { width, height } = this.scene.scale;

    // 浏览模式下不再单独放一个"返回"链接——点击列表里自己当前学派的卡片
    // （createSchoolCard 的 isOwn 分支）同样能退出这个列表，回到自己的学派
    const hint = this._text(
      width / 2, 100,
      browseMode ? '查看其他学院的分支与技能（只能查看，无法选择或升级）' : '请选择一个学派（选定后无法更换或重选）',
      { fontSize: '18px', color: THEME.accent, fontStyle: 'bold' }
    ).setOrigin(0.5);
    this.contentContainer.add(hint);

    const entries = Object.entries(ACADEMY_SKILL);
    // 卡片宽度按屏幕宽度自适应收缩（学派种类以后可能增加，避免整排卡片超出屏幕）
    const cardHeight = 280, spacing = 30, sideMargin = 40;
    const maxCardWidth = 220;
    const n = Math.max(1, entries.length);
    const fitWidth = Math.floor((width - sideMargin * 2 - spacing * (n - 1)) / n);
    const cardWidth = Math.max(160, Math.min(maxCardWidth, fitWidth));
    const totalWidth = n * cardWidth + Math.max(0, n - 1) * spacing;
    const startX = width / 2 - totalWidth / 2 + cardWidth / 2;
    const y = height / 2 + 20;

    entries.forEach(([schoolKey, school], index) => {
      const x = startX + index * (cardWidth + spacing);
      this.createSchoolCard(schoolKey, school, x, y, cardWidth, cardHeight, browseMode);
    });
  }

  createSchoolCard(schoolKey, school, x, y, cardWidth, cardHeight, browseMode = false) {
    // 浏览模式下，玩家自己真正选择的那个学派单独标出来（isOwn），点击它只是
    // 把 viewingSchoolKey 清空、回到"查看自己学派"的状态，不会走 chooseSchool
    const isOwn = browseMode && schoolKey === this.activeSchoolKey;

    const container = this.scene.add.container(x, y);
    // 选学派这一步原本统一用未解锁底板；浏览模式下额外用已解锁底板把"当前学派"
    // 区分出来，素材缺失时退回兜底矩形
    this._addCardPanel(container, cardWidth, cardHeight, isOwn ? UNLOCKED_PANEL_KEY : LOCKED_PANEL_KEY);

    const nameText = this._text(0, -cardHeight / 2 + 30, school.name, {
      fontSize: '22px', color: THEME.textPrimary, fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(nameText);

    if (isOwn) {
      const tagText = this._text(0, -cardHeight / 2 + 58, '（当前学派）', {
        fontSize: '13px', color: THEME.accent, fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(tagText);
    }

    const branchNames = Object.values(school.category ?? {}).map(c => c.name).join('\n');
    const branchList = this._text(0, 10, branchNames, {
      fontSize: '14px', color: THEME.textSecondary, align: 'center', lineSpacing: 8,
    }).setOrigin(0.5);
    container.add(branchList);

    const hintText = this._text(
      0, cardHeight / 2 - 26,
      browseMode ? (isOwn ? '点击返回' : '点击查看') : '点击选择',
      { fontSize: '14px', color: THEME.success, fontStyle: 'bold' }
    ).setOrigin(0.5);
    container.add(hintText);

    const hitArea = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);
    hitArea.on('pointerover', () => container.setScale(1.03));
    hitArea.on('pointerout', () => container.setScale(1));
    hitArea.on('pointerdown', () => {
      if (browseMode) {
        // 浏览模式下点击卡片只是切换"正在查看"的学派，绝不会调用 chooseSchool——
        // 真正绑定学派的入口始终只有非浏览模式（首次选择）下的这一处，保证学派
        // 一旦选定就不可更改
        this.viewingSchoolKey = isOwn ? null : schoolKey;
        this._showSchoolList = false;
        this.render();
        return;
      }
      this.chooseSchool(schoolKey);
    });

    this.contentContainer.add(container);
  }

  chooseSchool(schoolKey) {
    if (this.activeSchoolKey) return; // 已经选过学派了，正常情况下这个按钮不会出现，双重保险
    if (!ACADEMY_SKILL[schoolKey]) return;

    this.saveData.academy ??= { schools: {} };
    this.saveData.academy.schools ??= {};
    this.saveData.academy.schools[schoolKey] = { categories: {} };
    // 选择学派本身不消耗行动条，直接写入存档
    saveSystem.save();
    this.render();
  }

  // ── 第二步：分支列表（选择分支 / 升级分支）────────────────────────────

  /**
   * @param {string} schoolKey 要展示分支的学派——正常情况下等于玩家自己的 activeSchoolKey，
   * 浏览模式下可以是任意学派 key。
   * @param {boolean} isActiveSchool 这个 schoolKey 是否就是玩家自己真正选择的学派。为 false
   * 时表示"只读浏览别的学派"：不显示学院区数量警告，分支的"解锁分支"按钮永远不可点——
   * 已经解锁的分支天然只可能出现在玩家自己的学派下（getCategoryLevel 读的是
   * saveData.academy.schools[schoolKey]，别的学派在这里永远没有记录，level 恒为 0），
   * 所以已解锁分支的"升级"按钮代码路径本身就不会在浏览别的学派时被触发，不需要额外加判断。
   */
  renderBranches(schoolKey, isActiveSchool = true) {
    const school = ACADEMY_SKILL[schoolKey];
    if (!school) return; // 数据异常兜底，理论上不会发生

    const { width, height } = this.scene.scale;

    // 查看自己学派时提供"查看其他学院 >"入口；正在浏览别的学派时提供
    // "‹ 返回我的学派"，两者共用同一行位置，切换只影响文字/点击回调
    const toggleLink = this._text(
      width - 40, 70,
      isActiveSchool ? '查看其他学院 >' : '‹ 返回我的学派',
      { fontSize: '15px', color: THEME.textSecondary, fontStyle: 'bold' }
    ).setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => toggleLink.setColor(THEME.accent))
      .on('pointerout', () => toggleLink.setColor(THEME.textSecondary))
      .on('pointerdown', () => {
        if (isActiveSchool) {
          this._showSchoolList = true;
        } else {
          this.viewingSchoolKey = null;
        }
        this.render();
      });
    this.contentContainer.add(toggleLink);

    const subTitle = this._text(
      width / 2, 95,
      isActiveSchool ? `当前学派：${school.name}` : `查看学派：${school.name}`,
      { fontSize: '20px', color: THEME.accent, fontStyle: 'bold' }
    ).setOrigin(0.5);
    this.contentContainer.add(subTitle);

    const categoryEntries = Object.entries(school.category ?? {});
    const districtCount = countAcademyDistricts(this.saveData.map?.grids);
    const selectedCount = Object.keys(this.schools[schoolKey]?.categories ?? {}).length;
    const maxSelectable = Math.min(districtCount, categoryEntries.length, 4);

    // 学院区/特区被拆到 0 个：整套学派功能（选分支、升级分支）暂时锁住，顶部给一条
    // 醒目提示；这条提示、以及上面的"已解锁分支"统计，只在查看自己真正的学派时显示——
    // 浏览别的学派本来就不能操作，不需要这些和"我能不能操作"相关的提示
    let topY = 170;
    if (isActiveSchool) {
      const infoText = this._text(
        width / 2, 125,
        `已解锁分支：${selectedCount} / ${maxSelectable}　（每建成 1 座学院区/特区，可选择的分支数 +1，上限4条）`,
        { fontSize: '14px', color: THEME.textSecondary }
      ).setOrigin(0.5);
      this.contentContainer.add(infoText);

      if (districtCount <= 0) {
        const warnText = this._text(
          width / 2, 150,
          '当前没有已完工的学院区/特区，学派功能暂时锁定，需要重新建成学院区/特区',
          { fontSize: '13px', color: THEME.danger, fontStyle: 'bold' }
        ).setOrigin(0.5);
        this.contentContainer.add(warnText);
        topY = 195;
      }
    } else {
      const browseInfoText = this._text(
        width / 2, 125,
        '正在查看该学派的分支与技能，无法选择或升级',
        { fontSize: '14px', color: THEME.textSecondary }
      ).setOrigin(0.5);
      this.contentContainer.add(browseInfoText);
    }

    // 卡片宽度按屏幕宽度自适应收缩（学派最多4条分支，窄屏/小窗口时避免整排卡片超出屏幕），
    // 但不小于180px，保证分支名和技能文字还能正常显示
    const cardHeight = 360, spacing = 24, sideMargin = 40;
    const maxCardWidth = 260;
    const availableWidth = width - sideMargin * 2;
    const n = Math.max(1, categoryEntries.length);
    const fitWidth = Math.floor((availableWidth - spacing * (n - 1)) / n);
    const cardWidth = Math.max(180, Math.min(maxCardWidth, fitWidth));
    const totalWidth = n * cardWidth + Math.max(0, n - 1) * spacing;
    const startX = width / 2 - totalWidth / 2 + cardWidth / 2;

    categoryEntries.forEach(([catKey, category], index) => {
      const x = startX + index * (cardWidth + spacing);
      const y = topY + cardHeight / 2;
      this.createBranchCard(schoolKey, catKey, category, x, y, cardWidth, cardHeight, selectedCount, maxSelectable, districtCount, isActiveSchool);
    });
  }

  createBranchCard(schoolKey, catKey, category, x, y, cardWidth, cardHeight, selectedCount, maxSelectable, districtCount, isActiveSchool = true) {
    const level = getCategoryLevel(this.saveData, schoolKey, catKey);
    const unlocked = level > 0;

    const container = this.scene.add.container(x, y);
    // 已解锁（level > 0，正在使用/升级中）用 unlocked_panel，还没选择这条分支用 locked_panel
    this._addCardPanel(container, cardWidth, cardHeight, unlocked ? UNLOCKED_PANEL_KEY : LOCKED_PANEL_KEY);

    // 面板美术自带的分割线：上半区放名字/等级，下半区放灰色说明文字，见 CARD_DIVIDER_Y_RATIO
    const dividerLocalY = -cardHeight / 2 + cardHeight * CARD_DIVIDER_Y_RATIO;

    // ── 上半区：名字（已解锁的话名字下面再放等级）──
    const nameText = this._text(0, -cardHeight / 2 + 30, category.name, {
      fontSize: '20px', color: unlocked ? THEME.textPrimary : THEME.textDisabled, fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(nameText);

    if (unlocked) {
      // 分支不设等级上限，可以一直升，所以这里只显示当前等级，不再显示"/ 最高等级"
      const levelText = this._text(0, -cardHeight / 2 + 62, `等级 ${level}`, {
        fontSize: '16px', color: THEME.accent, fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(levelText);
    }

    if (!unlocked) {
      // maxSelectable 里已经把 districtCount 算进去了，districtCount 为 0 时 maxSelectable
      // 也会是 0，canSelect 自然为 false；另外 isActiveSchool 为 false（正在只读浏览别的
      // 学派）时一律不能选择——浏览是纯只读的，不管学院区数量/已选分支数量是否满足
      const canSelect = isActiveSchool && selectedCount < maxSelectable;
      const lockReason = !isActiveSchool
        ? '未解锁'
        : (districtCount <= 0 ? '未解锁\n（没有学院区/特区）' : '未解锁\n（需要更多学院区/特区）');
      // 下半区：分割线和按钮之间放"未解锁"提示 + "查看技能"入口两行，位置按比例分配，
      // 这样不管卡片高度怎么变，两行都不会挤到一起或撞到按钮
      const btnW = 130, btnH = 38;
      const btnY = cardHeight / 2 - 40;
      const zoneTop = dividerLocalY;
      const zoneBottom = btnY - btnH / 2;
      const stateTextY = zoneTop + (zoneBottom - zoneTop) * 0.32;
      const viewSkillY = zoneTop + (zoneBottom - zoneTop) * 0.8;

      const stateText = this._text(0, stateTextY, canSelect ? '未解锁' : lockReason, {
        fontSize: '15px', color: THEME.textDisabled, align: 'center', lineSpacing: 6,
      }).setOrigin(0.5);
      container.add(stateText);

      // 还没选择/解锁的分支也能看它整条技能线长什么样，帮玩家判断值不值得选这条分支
      this._addViewSkillLink(container, viewSkillY, schoolKey, catKey, category.name);

      // 满足条件（canSelect）可以点击时显示"解锁分支"+confirm.png，不满足时
      // 显示"未解锁"+unconfirm.png（整体灰化，见 _addActionButton）
      const { btnBg } = this._addActionButton(container, 0, btnY, btnW, btnH, canSelect ? '解锁分支' : '未解锁', canSelect);

      if (canSelect) {
        btnBg.setInteractive({ useHandCursor: true });
        btnBg.on('pointerover', () => btnBg.setAlpha(0.85));
        btnBg.on('pointerout', () => btnBg.setAlpha(1));
        btnBg.on('pointerdown', () => this.chooseCategory(schoolKey, catKey));
      }

      this.contentContainer.add(container);
      return;
    }

    // ── 下半区：不再罗列全部技能，改成一个"查看技能"入口——保持目前的灰色说明文字
    // 样式（不是图片按钮），点击后打开 AcademySkillProgressViewer 横向滚动查看
    // 从 1 级到配置表最高等级的完整技能线，见文件末尾的类定义。
    this._addViewSkillLink(container, dividerLocalY + 30, schoolKey, catKey, category.name);

    // 升级按钮固定贴在卡片底部——分支不设等级上限，只要文化够、行动条够、
    // 学院区/特区数量大于0，就可以一直升，点击后先弹出二次确认（showUpgradeConfirm）。
    // 这个代码分支只有 unlocked === true 才会走到，而 unlocked 只在玩家自己真正选择的
    // 学派（saveData.academy.schools[schoolKey] 有记录）下才可能为 true，浏览别的学派
    // 时 getCategoryLevel 恒为 0，永远不会走到这里，不需要再额外用 isActiveSchool 判断。
    const btnY = cardHeight / 2 - 44;
    const cost = getUpgradeCost(level);
    const culture = this.saveData.resource?.culture ?? 0;
    const upgradeKey = `${schoolKey}_${catKey}`;
    const pending = this._pendingUpgradeKeys.has(upgradeKey);
    const canAfford = culture >= cost;
    const hasSlot = game.hasAvailableAction('civil');
    const hasDistrict = districtCount > 0;
    // hasDistrict 这一条是关键：哪怕分支早就选好了、文化和行动条也都够，只要当前
    // 一个学院区/特区都没有，就不许继续升级——防止靠"临时建区→升级→拆区"的手法
    // 绕开"可选/可升分支数量取决于学院区数量"这个限制，见文件顶部的说明。
    const canUpgrade = canAfford && hasSlot && hasDistrict && !pending;

    const { btnBg } = this._addActionButton(
      container, 0, btnY, 150, 40,
      pending ? '处理中…' : '升级',
      canUpgrade
    );

    if (canUpgrade) {
      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on('pointerover', () => btnBg.setAlpha(0.85));
      btnBg.on('pointerout', () => btnBg.setAlpha(1));
      btnBg.on('pointerdown', () => this.showUpgradeConfirm(schoolKey, catKey, category.name, level, cost));
    } else if (!pending) {
      let reason = '';
      if (!hasDistrict) reason = '没有学院区/特区';
      else if (!canAfford) reason = '文化不足';
      else if (!hasSlot) reason = '民生行动条已用完';
      if (reason) {
        const reasonTxt = this._text(0, btnY + 28, reason, {
          fontSize: '12px', color: THEME.danger,
        }).setOrigin(0.5);
        container.add(reasonTxt);
      }
    }

    this.contentContainer.add(container);
  }

  /** 选择一条分支：不消耗行动条/资源，直接获得1级，正常情况下不能重选 */
  chooseCategory(schoolKey, catKey) {
    const school = this.schools[schoolKey];
    if (!school) return;
    school.categories ??= {};
    if (school.categories[catKey] != null) return; // 已选择过，不能重选

    const categoryCount = Object.keys(ACADEMY_SKILL[schoolKey]?.category ?? {}).length;
    const districtCount = countAcademyDistricts(this.saveData.map?.grids);
    const maxSelectable = Math.min(districtCount, categoryCount, 4);
    const selectedCount = Object.keys(school.categories).length;
    if (selectedCount >= maxSelectable) return; // 双重保险，按钮理论上已不可点

    school.categories[catKey] = 1;
    saveSystem.save();
    this.render();
  }

  /** 升级一条已选择的分支：消耗民生行动条 + 对应等级的文化，成功后等级+1 */
  upgradeCategory(schoolKey, catKey, fromLevel, cost) {
    const upgradeKey = `${schoolKey}_${catKey}`;
    if (this._pendingUpgradeKeys.has(upgradeKey)) return;
    // 双重保险：按钮理论上在没有学院区/特区时已经不可点，这里再核实一次当前学院区数量，
    // 避免任何情况下（比如渲染状态没及时刷新）绕过"拆光学院区就不能继续升级"这条限制
    if (countAcademyDistricts(this.saveData.map?.grids) <= 0) return;
    this._pendingUpgradeKeys.add(upgradeKey);
    this.render(); // 立刻刷新一次，让按钮马上进入"处理中"禁用态，避免请求还没返回时被重复点击

    const actionKey = `academy_upgrade_${schoolKey}_${catKey}_${Date.now()}`;
    game.addAction('civil', actionKey, { schoolKey, catKey, fromLevel }, {
      onSuccess: () => {
        const res = this.saveData.resource ?? {};
        res.culture = (res.culture ?? 0) - cost;
        const school = this.schools[schoolKey];
        if (school) {
          school.categories ??= {};
          // 以 fromLevel+1 为准而不是简单自增，避免和其它地方的并发修改冲突
          school.categories[catKey] = fromLevel + 1;
        }
        saveSystem.save();
        this._pendingUpgradeKeys.delete(upgradeKey);
        this.render();
      },
      onFail: (info) => {
        this._pendingUpgradeKeys.delete(upgradeKey);
        if (info.reason === 'limit') {
          game.showTips(this.scene, '民生行动数量超过上限');
        }
        this.render();
      },
    });
  }

  /**
   * 分支升级二次确认弹窗：点击"升级"按钮先弹出这个面板，玩家点"确认"才真正调用
   * upgradeCategory 扣资源+加等级；点"取消"或点遮罩空白处只关闭弹窗，不会有任何副作用。
   * overlay/modal 直接加到场景里（不挂在 this.mainContainer 下面），用比 mainContainer
   * 更高的 depth 盖住整个学派界面，和 militaryUnitView.js 里"训练确认"弹窗是同一种做法。
   */
  showUpgradeConfirm(schoolKey, catKey, categoryName, fromLevel, cost) {
    // 同一时间只允许一个确认弹窗存在，避免连续点击升级按钮堆出多个弹窗
    if (this._activeModal) {
      this._activeModal.overlay.destroy();
      this._activeModal.modal.destroy();
      this._activeModal = null;
    }

    const { width, height } = this.scene.scale;
    const nextLevel = fromLevel + 1;

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.35)
      .setDepth(1150)
      .setInteractive();

    const modalW = 440, modalH = 190;
    const modal = this.scene.add.container(width / 2, height / 2).setDepth(1151);

    const modalBg = this.scene.add.rectangle(0, 0, modalW, modalH, THEME.cardBgHex, 0.98);
    const modalBorder = this.scene.add.rectangle(0, 0, modalW, modalH).setStrokeStyle(2, THEME.cardBorderHex);
    modal.add([modalBg, modalBorder]);

    const title = this._text(0, -modalH / 2 + 30, '确认升级', {
      fontSize: '18px', color: THEME.textPrimary, fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(title);

    // "将【分支名】升级到 X 级需要 🔥 × 40，是否升级？"——文化图标要内嵌在文字中间，
    // Phaser 的 Text 没法在字符串里插图片，只能用 _addInlineRow 手动把文字和图标拼成一行
    this._addInlineRow(modal, -16, [
      { text: `将【${categoryName}】升级到 ${nextLevel} 级需要`, style: { fontSize: '15px', color: THEME.textPrimary } },
      { icon: 'icon_culture', size: 22 },
      { text: `× ${cost}`, style: { fontSize: '15px', color: THEME.accent, fontStyle: 'bold' } },
    ]);

    const askText = this._text(0, 16, '是否升级？', {
      fontSize: '15px', color: THEME.textSecondary,
    }).setOrigin(0.5);
    modal.add(askText);

    const closeModal = () => {
      overlay.destroy();
      modal.destroy();
      this._activeModal = null;
    };
    this._activeModal = { overlay, modal };

    const btnY = modalH / 2 - 36;
    const { btnBg: confirmBg } = this._addActionButton(modal, 70, btnY, 130, 40, '确认', true);
    confirmBg.setInteractive({ useHandCursor: true });
    confirmBg.on('pointerover', () => confirmBg.setAlpha(0.85));
    confirmBg.on('pointerout', () => confirmBg.setAlpha(1));
    confirmBg.on('pointerdown', () => {
      closeModal();
      this.upgradeCategory(schoolKey, catKey, fromLevel, cost);
    });

    const { btnBg: cancelBg } = this._addActionButton(modal, -70, btnY, 130, 40, '取消', false);
    cancelBg.setInteractive({ useHandCursor: true });
    cancelBg.on('pointerover', () => cancelBg.setAlpha(0.85));
    cancelBg.on('pointerout', () => cancelBg.setAlpha(1));
    cancelBg.on('pointerdown', () => closeModal());

    overlay.on('pointerdown', () => closeModal());
  }

  /**
   * 把一组"文字/图标"片段横排成一行并整体居中——比如升级确认弹窗里"将XX升级到X级
   * 需要🔥×40"这种文字中间夹一个资源图标的场景，Phaser 的 Text 没法在字符串里内嵌
   * 图片，只能这样手动依次摆放。items 里每一项是 { text, style } 或 { icon, size }，
   * 按顺序从左到右排列，整行以传入的 y（container 局部坐标系）为基准水平居中。
   */
  _addInlineRow(container, y, items, gap = 4) {
    const built = items.map(item => {
      if (item.icon) {
        const img = this.scene.add.image(0, y, item.icon).setDisplaySize(item.size, item.size);
        return { obj: img, width: item.size, isIcon: true };
      }
      const txt = this._text(0, y, item.text, item.style || {}).setOrigin(0, 0.5);
      return { obj: txt, width: txt.width, isIcon: false };
    });
    const totalWidth = built.reduce((s, b) => s + b.width, 0) + gap * Math.max(0, built.length - 1);
    let cursorX = -totalWidth / 2;
    built.forEach(b => {
      b.obj.setPosition(b.isIcon ? cursorX + b.width / 2 : cursorX, y);
      container.add(b.obj);
      cursorX += b.width + gap;
    });
  }

  destroy() {
    if (this._activeModal) {
      this._activeModal.overlay.destroy();
      this._activeModal.modal.destroy();
      this._activeModal = null;
    }
    if (this.mainContainer) this.mainContainer.destroy();
  }
}

/**
 * 学派分支的技能进度查看器：横向可滚动地展示某个分支从 1 级到配置表里最高等级的
 * 每一级技能列表，每一级一列，列与列之间用箭头连接，直观地看到"整条科技线"长什么样。
 * 分支本身不设等级上限（见 AcademyViewer.createBranchCard），但技能只在
 * academy_skill.js 配置到的等级里存在，超过配置的最高等级之后继续升级只是单纯涨
 * "等级"数字、消耗更多文化，没有新技能——这个查看器只需要展示配置表里已经写好的这些列，
 * 列数固定为 1..getCategoryMaxLevel，不会随分支等级继续升高而增加。
 *
 * 技能图标沿用 military_ui.js/militaryUnitView.js 里"技能图鉴"的既有做法：图标不是
 * 预先加载好的 Phaser 纹理，而是直接用 DOM <img> 读 assets/military/skill/{key}.png。
 * DOM 元素不受 Phaser 的 setMask 影响（渲染在 canvas 上层，遮罩只裁剪 WebGL/Canvas
 * 内容），所以横向滚动时改用手动裁剪：_updateIconClipping 根据每个图标的左右边界
 * 相对遮罩可视范围的位置，用 clip-path 精确裁掉滚出可视区域的部分，和
 * militaryUnitView.js 里 MilitarySkillViewer._updateIconClipping 是同一套做法，
 * 只是那边是纵向滚动按上下裁，这里是横向滚动按左右裁。
 */
export class AcademySkillProgressViewer {
  constructor(scene, saveData, schoolKey, catKey, categoryName) {
    this.scene = scene;
    this.saveData = saveData;
    this.schoolKey = schoolKey;
    this.catKey = catKey;
    this.categoryName = categoryName;
    this.mainContainer = null;

    this.scrollX = 0;
    this.maxScrollX = 0;
    this.isDragging = false;
    // 技能图标是 DOM 元素，见类注释——这里记录每个图标的左右边界，供
    // _updateIconClipping 按滚动位置手动裁剪
    this._skillIconDoms = [];

    // 正在提交中的"学习技能"请求（兵组id_技能key），防止 addAction 的异步回调
    // 还没返回时重复点击同一行，见 AcademyViewer._pendingUpgradeKeys 同款做法
    this._pendingLearnKeys = new Set();

    this._onPointerDown = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
    this._onWheel = null;

    this.create();
  }

  /** 见文件顶部的模块级 themedText */
  _text(x, y, content, style = {}) {
    return themedText(this.scene, x, y, content, style);
  }

  create() {
    const { width, height } = this.scene.scale;
    // 深度比 AcademyViewer 的 mainContainer（1100）高，盖住整个学派界面，
    // 背景/头图/关闭按钮的做法和 AcademyViewer.create() 完全一致——不用半透明遮罩，
    // 是一整张实底的界面，不是浮在分支卡片上面的浮窗
    this.mainContainer = this.scene.add.container(0, 0).setDepth(1150);

    if (this.scene.textures.exists(BG_IMAGE_KEY)) {
      const bgImage = this.scene.add.image(width / 2, height / 2, BG_IMAGE_KEY);
      const coverScale = Math.max(width / bgImage.width, height / bgImage.height);
      bgImage.setScale(coverScale);
      this.mainContainer.add(bgImage);
    }

    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0.2);
    bg.setInteractive(); // 阻挡穿透，不让点击漏到下层的学派分支卡片
    this.mainContainer.add(bg);

    this.createHeader();
    this.createCloseButton();

    this.titleText = this._text(width / 2, 46, `${this.categoryName} · 技能进度`, {
      fontSize: '28px', color: THEME.textPrimary, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.mainContainer.add(this.titleText);

    this.contentContainer = this.scene.add.container(0, 0);
    this.mainContainer.add(this.contentContainer);

    this.buildColumns();
    this.createScrollBar();
    this.setupDragging();
    this.setupWheel();
  }

  /** 左上角标题牌，和 AcademyViewer.createHeader 完全一致 */
  createHeader() {
    if (!this.scene.textures.exists(HEADER_IMAGE_KEY)) return;
    const header = this.scene.add.image(0, 0, HEADER_IMAGE_KEY).setOrigin(0, 0);
    const targetHeight = 84;
    header.setScale(targetHeight / header.height);
    this.mainContainer.add(header);
  }

  /** 右上角退出按钮，和 AcademyViewer.createCloseButton 完全一致，点击关闭的是这个子界面 */
  createCloseButton() {
    const { width } = this.scene.scale;

    if (this.scene.textures.exists(CLOSE_IMAGE_KEY)) {
      const closeBtn = this.scene.add.image(width, 0, CLOSE_IMAGE_KEY).setOrigin(1, 0);
      closeBtn.setScale(60 / closeBtn.height);
      closeBtn.setInteractive({ useHandCursor: true });
      closeBtn.on('pointerover', () => closeBtn.setAlpha(0.85));
      closeBtn.on('pointerout', () => closeBtn.setAlpha(1));
      closeBtn.on('pointerdown', () => this.destroy());
      this.mainContainer.add(closeBtn);
      return;
    }

    const closeBtn = this._text(width - 50, 40, '退出', {
      fontSize: '20px', backgroundColor: '#cc0000', color: THEME.textOnButton, padding: { x: 10, y: 5, top: 4 },
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.destroy());
    this.mainContainer.add(closeBtn);
  }

  /**
   * 逐级建列：level 从 1 到配置表最高等级，每一级都一定有一列（哪怕那一级没有配置
   * 任何技能，也画一列空的出来，保证"整条科技线"看起来是连续的），列之间画箭头。
   */
  buildColumns() {
    const { width, height } = this.scene.scale;
    const TOP = 100, BOTTOM = 80; // 上：标题+关闭按钮；下：横向滚动条
    const COL_W = 130, COL_GAP = 60, SIDE_PAD = 20;

    const skillMap = ACADEMY_SKILL?.[this.schoolKey]?.category?.[this.catKey]?.skill ?? {};
    const maxLevel = Math.max(1, getCategoryMaxLevel(this.schoolKey, this.catKey));
    const currentLevel = getCategoryLevel(this.saveData, this.schoolKey, this.catKey);

    const frameTop = TOP + 20;
    const frameHeight = height - BOTTOM - frameTop;

    for (let lv = 1; lv <= maxLevel; lv++) {
      const colX = SIDE_PAD + (lv - 1) * (COL_W + COL_GAP) + COL_W / 2;
      const unlocked = lv <= currentLevel;
      this.createLevelColumn(lv, colX, frameTop, frameHeight, COL_W, unlocked, skillMap[lv] ?? []);

      if (lv < maxLevel) {
        const arrowX = colX + COL_W / 2 + COL_GAP / 2;
        const arrow = this._text(arrowX, frameTop + frameHeight / 2, '→', {
          fontSize: '28px', color: THEME.textSecondary, fontStyle: 'bold',
        }).setOrigin(0.5);
        this.contentContainer.add(arrow);
      }
    }

    const totalContentWidth = SIDE_PAD * 2 + maxLevel * COL_W + (maxLevel - 1) * COL_GAP;
    this.maxScrollX = Math.max(0, totalContentWidth - width);

    // 遮罩：只在标题栏下方、底部滚动条上方这块区域显示内容，普通 Phaser 内容
    // （列框、等级标签、箭头）横向滚动超出这块区域会被裁掉；DOM 技能图标不受
    // 这个遮罩影响，另外走 _updateIconClipping 手动裁剪，见类注释
    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, TOP, width, height - TOP - BOTTOM);
    this.contentContainer.setMask(maskShape.createGeometryMask());
    this._maskShape = maskShape;
    this._maskLeft = 0;
    this._maskRight = width;

    this._updateIconClipping();
  }

  createLevelColumn(level, x, frameTop, frameHeight, colWidth, unlocked, skillKeys) {
    const frameBg = this.scene.add.rectangle(x, frameTop + frameHeight / 2, colWidth, frameHeight,
      unlocked ? 0xffffff : 0xeaeaea, unlocked ? 0.92 : 0.9);
    const frameBorder = this.scene.add.rectangle(x, frameTop + frameHeight / 2, colWidth, frameHeight)
      .setStrokeStyle(2, unlocked ? THEME.accentHex : THEME.cardBorderHex);
    this.contentContainer.add([frameBg, frameBorder]);

    const levelLabel = this._text(x, frameTop + 20, `Lv.${level}`, {
      fontSize: '16px', color: unlocked ? THEME.accent : THEME.textDisabled, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.contentContainer.add(levelLabel);

    // 图标可用的竖直区域：顶部让出等级标签，底部留一点边距
    const innerTop = frameTop + 46;
    const innerHeight = (frameTop + frameHeight - 16) - innerTop;
    const n = skillKeys.length;

    if (n === 0) {
      const emptyText = this._text(x, innerTop + innerHeight / 2, '（无技能）', {
        fontSize: '12px', color: THEME.textDisabled,
      }).setOrigin(0.5);
      this.contentContainer.add(emptyText);
      return;
    }

    // 均衡分布：n 个图标把竖直区间分成 n+1 份，图标放在每个分割点上——
    // 1 个技能在正中间（1/2 处），2 个技能在 1/3、2/3 处（三等分，间距相等），以此类推
    const iconSize = 44;
    skillKeys.forEach((skKey, i) => {
      const iconY = innerTop + innerHeight * ((i + 1) / (n + 1));
      this.createSkillIcon(skKey, x, iconY, iconSize, unlocked);
    });
  }

  createSkillIcon(skillKey, x, y, size, unlocked) {
    // 技能图标用 DOM <img> 直接读 assets/military/skill/{key}.png，和"技能图鉴"
    // （militaryUnitView.js::MilitarySkillViewer）同一份素材、同一种做法。这里图标
    // 是可点击的（pointer-events:auto），点击打开 showSkillDetail 技能详情弹窗。
    const iconEl = document.createElement('img');
    iconEl.src = `assets/military/skill/${skillKey}.png`;
    iconEl.style.cssText = `width:${size}px;height:${size}px;object-fit:contain;display:block;pointer-events:auto;cursor:pointer;`;
    const iconDom = this.scene.add.dom(x, y, iconEl);
    iconDom.setAlpha(unlocked ? 1 : 0.6);
    this.contentContainer.add(iconDom);

    // 素材加载失败的图标要一直隐藏，不能被 _updateIconClipping 按滚动位置重新显示出来
    const iconState = { failed: false };
    iconEl.onerror = () => {
      iconState.failed = true;
      iconDom.setVisible(false);
    };

    iconEl.addEventListener('click', () => {
      if (iconState.failed) return;
      this.showSkillDetail(skillKey, unlocked);
    });

    // 图标接管了鼠标事件后，滚轮事件会被它截走、传不到下层 canvas，导致 Phaser
    // 全局注册的 wheel 监听收不到——鼠标放在图标上时没法横向滚动。这里把原生
    // wheel 事件转发给 _scrollBy（做法和 militaryUnitView.js::MilitarySkillViewer
    // 转发 wheel 给 onMouseWheel 一致），并阻止默认的页面滚动行为。
    iconEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._scrollBy(e.deltaY);
    }, { passive: false });

    const skillName = MILITARY_SKILL[skillKey]?.name ?? skillKey;
    const nameText = this._text(x, y + size / 2 + 10, skillName, {
      fontSize: '11px', color: unlocked ? THEME.textSecondary : THEME.textDisabled, align: 'center',
      wordWrap: { width: 100 },
    }).setOrigin(0.5, 0);
    this.contentContainer.add(nameText);

    // 记录左右边界（局部坐标系，不含滚动偏移），供 _updateIconClipping 换算成
    // 屏幕坐标后跟遮罩可视范围比较
    this._skillIconDoms.push({ dom: iconDom, el: iconEl, state: iconState, left: x - size / 2, right: x + size / 2 });
  }

  /**
   * 手动裁剪技能图标（DOM 元素不受 Phaser 遮罩影响，见类注释）。做法和
   * militaryUnitView.js::MilitarySkillViewer._updateIconClipping 完全一致，只是这里
   * 是横向滚动，按左右边界裁剪（inset 的裁剪量放在 right/left 位置）而不是上下。
   */
  _updateIconClipping() {
    if (!this._skillIconDoms || this._skillIconDoms.length === 0) return;
    const maskLeft = this._maskLeft;
    const maskRight = this._maskRight;
    const offsetX = this.contentContainer.x;

    this._skillIconDoms.forEach(({ dom, el, state, left, right }) => {
      if (state?.failed) return;

      const screenLeft = left + offsetX;
      const screenRight = right + offsetX;
      const fullyOutside = screenRight <= maskLeft || screenLeft >= maskRight;

      if (fullyOutside) {
        dom.setVisible(false);
        return;
      }

      dom.setVisible(true);
      const clipLeft = Math.max(0, maskLeft - screenLeft);
      const clipRight = Math.max(0, screenRight - maskRight);
      el.style.clipPath = (clipLeft > 0 || clipRight > 0)
        ? `inset(0px ${clipRight}px 0px ${clipLeft}px)`
        : '';
    });
  }

  /** 底部横向滚动条（轨道+滑块），做法和 techTree.js::createScrollBar 一致 */
  createScrollBar() {
    if (this.maxScrollX <= 0) return;
    const { width, height } = this.scene.scale;
    const barW = width - 100, barX = 50, y = height - 36;

    this.mainContainer.add(this.scene.add.rectangle(width / 2, y, barW, 8, 0xd8d8d8));

    const handleW = Math.max(90, barW * (width / (width + this.maxScrollX)));
    this.scrollHandle = this.scene.add.rectangle(barX + handleW / 2, y, handleW, 18, THEME.accentHex);
    this.scrollHandle.setInteractive({ draggable: true });
    this.mainContainer.add(this.scrollHandle);

    this._handleW = handleW;
    this._barX = barX;
    this._barW = barW;

    this.scrollHandle.on('drag', (_, dx) => {
      const min = barX + handleW / 2, max = barX + barW - handleW / 2;
      const hx = Phaser.Math.Clamp(dx, min, max);
      this.scrollHandle.x = hx;
      const p = (hx - min) / (max - min);
      this.scrollX = p * this.maxScrollX;
      this.contentContainer.x = -this.scrollX;
      this._updateIconClipping();
    });
  }

  updateScrollHandle() {
    if (!this.scrollHandle || this.maxScrollX <= 0) return;
    const min = this._barX + this._handleW / 2, max = this._barX + this._barW - this._handleW / 2;
    this.scrollHandle.x = min + (this.scrollX / this.maxScrollX) * (max - min);
  }

  /** 拖拽滚动：在面板任意位置按住拖动即可横向滚动，做法和 techTree.js::setupDragging 一致 */
  setupDragging() {
    let startX = 0, startContent = 0;

    this._onPointerDown = p => { startX = p.x; startContent = this.contentContainer.x; };
    this._onPointerMove = p => {
      if (!p.isDown || this.maxScrollX <= 0) return;
      const dx = p.x - startX;
      if (Math.abs(dx) > 6) {
        this.isDragging = true;
        const nx = Phaser.Math.Clamp(startContent + dx, -this.maxScrollX, 0);
        this.contentContainer.x = nx;
        this.scrollX = -nx;
        this.updateScrollHandle();
        this._updateIconClipping();
      }
    };
    this._onPointerUp = () => { setTimeout(() => (this.isDragging = false), 30); };

    this.scene.input.on('pointerdown', this._onPointerDown);
    this.scene.input.on('pointermove', this._onPointerMove);
    this.scene.input.on('pointerup', this._onPointerUp);
  }

  /**
   * 横向滚动的实际执行逻辑，抽成独立方法是因为有两个入口都要用：Phaser 的全局
   * 'wheel' 事件（见 setupWheel），以及技能图标自己截获的原生 wheel 事件（DOM
   * 元素挡住了下面的 canvas，鼠标放在图标上时 Phaser 收不到 wheel，需要图标自己
   * 转发过来，见 createSkillIcon）。
   */
  _scrollBy(deltaY) {
    if (this.maxScrollX <= 0) return;
    this.scrollX = Phaser.Math.Clamp(this.scrollX + deltaY * 0.5, 0, this.maxScrollX);
    this.contentContainer.x = -this.scrollX;
    this.updateScrollHandle();
    this._updateIconClipping();
  }

  /** 鼠标滚轮也能横向滚动（用 deltaY，滚轮上下滚动对应内容左右移动，横向列表的常见习惯） */
  setupWheel() {
    this._onWheel = (pointer, gameObjects, deltaX, deltaY) => {
      this._scrollBy(deltaY);
    };
    this.scene.input.on('wheel', this._onWheel);
  }

  /**
   * 技能详情/选兵弹窗的通用外壳：遮罩和弹窗卡片各自是独立的 scene.add.dom()
   * 对象（不是拿一个 div 套一个 div），和技能图标（也是各自独立的 add.dom）
   * 保持同一种做法。两者都居中挂在画布中心：遮罩节点尺寸等于整个画布，正好
   * 铺满；弹窗节点尺寸更小，视觉上叠在遮罩上方。靠 setDepth 同步出来的
   * z-index 保证弹窗盖住遮罩、也盖住技能图标，不需要额外的层级补丁。
   * 返回 { overlayDom, modalDom, overlay, modal }：*Dom 是 Phaser 的 DOM
   * GameObject（负责 destroy），overlay/modal 是各自的 HTMLElement，往 modal
   * 里塞内容即可。
   */
  _createDomOverlay(modalWidth, modalHeight = null) {
    const { width, height } = this.scene.scale;

    const overlay = document.createElement('div');
    overlay.style.cssText = `width:${width}px; height:${height}px; background:rgba(0,0,0,0.4); pointer-events:auto;`;
    const overlayDom = this.scene.add.dom(width / 2, height / 2, overlay).setDepth(5000);

    const modal = document.createElement('div');
    const maxH = Math.min(modalHeight ?? (height - 40), height - 40);
    modal.style.cssText = `
      width:${modalWidth}px; ${modalHeight ? `height:${maxH}px;` : `max-height:${maxH}px;`}
      box-sizing:border-box; background:rgba(255,255,255,0.98);
      border:2px solid #d0d0d0; border-radius:8px; padding:20px;
      position:relative; display:flex; flex-direction:column; align-items:stretch;
      overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain;
      font-family:inherit; pointer-events:auto;
    `;
    const modalDom = this.scene.add.dom(width / 2, height / 2, modal).setDepth(5001);

    return { overlayDom, modalDom, overlay, modal };
  }

  /** 弹窗右上角的"×"关闭按钮，两个弹窗共用同一套样式 */
  _buildDomCloseButton(onClose) {
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position:absolute; top:6px; right:12px;
      font-size:22px; font-weight:bold; color:${THEME.textSecondary};
      cursor:pointer; line-height:1; user-select:none;
    `;
    closeBtn.addEventListener('click', onClose);
    return closeBtn;
  }

  /**
   * 技能详情弹窗：点击某个技能图标后弹出，显示名字/图标/效果/所属学派与分支。
   * 只有这个技能在当前分支等级下已经解锁（unlocked，也就是调用方传进来的、和
   * 图标本身是否变灰同一个判断）才会显示"学习"按钮——未解锁的技能只能看不能学。
   */
  showSkillDetail(skillKey, unlocked) {
    this._closeDetailModal();

    const skill = MILITARY_SKILL[skillKey];
    const schoolName = ACADEMY_SKILL[this.schoolKey]?.name ?? this.schoolKey;
    // 学派功能被拆光学院区/特区锁住时，"学习"也跟着锁住——和分支的选择/升级
    // 遵守同一条规则（见 AcademyViewer 文件顶部关于防拆区卡bug的说明）
    const districtLocked = countAcademyDistricts(this.saveData.map?.grids) <= 0;

    const { overlayDom, modalDom, overlay, modal } = this._createDomOverlay(380);

    modal.appendChild(this._buildDomCloseButton(() => this._closeDetailModal()));

    const nameEl = document.createElement('div');
    nameEl.textContent = skill?.name ?? skillKey;
    nameEl.style.cssText = `font-size:20px; font-weight:bold; color:${THEME.textPrimary}; text-align:center; margin-bottom:16px;`;
    modal.appendChild(nameEl);

    // 图标用一个 width:100% + justify-content:center 的包装 div 来居中，不依赖
    // align-self（父级是 align-items:stretch，align-self 本该也能生效，但实测在
    // 部分渲染环境下不可靠，用一个专门的居中容器更保险）
    const iconEl = document.createElement('img');
    iconEl.src = `assets/military/skill/${skillKey}.png`;
    iconEl.style.cssText = `width:64px; height:64px; object-fit:contain;`;
    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = `width:100%; display:flex; justify-content:center; margin-bottom:12px;`;
    iconWrap.appendChild(iconEl);
    modal.appendChild(iconWrap);

    // 所属学派/分支紧跟在图标下面、技能描述上面
    const sourceEl = document.createElement('div');
    sourceEl.textContent = `${schoolName}学派 · ${this.categoryName}`;
    sourceEl.style.cssText = `font-size:13px; font-weight:bold; color:${THEME.accent}; text-align:center; margin-bottom:14px;`;
    modal.appendChild(sourceEl);

    const desEl = document.createElement('div');
    desEl.textContent = skill?.des ?? '（暂无技能描述）';
    desEl.style.cssText = `font-size:14px; color:${THEME.textSecondary}; text-align:center; line-height:1.6; white-space:pre-wrap; margin-bottom:14px;`;
    modal.appendChild(desEl);

    if (unlocked && districtLocked) {
      const lockedEl = document.createElement('div');
      lockedEl.textContent = '学派功能暂时锁定（没有已完工的学院区/特区），暂时无法学习';
      lockedEl.style.cssText = `font-size:12px; color:${THEME.danger}; text-align:center; line-height:1.5; margin-top:8px;`;
      modal.appendChild(lockedEl);
    } else if (unlocked) {
      const learnBtn = document.createElement('div');
      learnBtn.textContent = '学习';
      learnBtn.style.cssText = `
        width:140px; height:40px;
        background-image:url('assets/ui/confirm.png'); background-size:100% 100%; background-repeat:no-repeat;
        display:flex; align-items:center; justify-content:center;
        color:${THEME.textOnButton}; font-size:15px; font-weight:bold; cursor:pointer;
      `;
      learnBtn.addEventListener('mouseenter', () => { learnBtn.style.opacity = '0.85'; });
      learnBtn.addEventListener('mouseleave', () => { learnBtn.style.opacity = '1'; });
      learnBtn.addEventListener('click', () => {
        this._closeDetailModal();
        this.showLearnUnitPicker(skillKey);
      });
      const btnWrap = document.createElement('div');
      btnWrap.style.cssText = `width:100%; display:flex; justify-content:center; margin-top:10px;`;
      btnWrap.appendChild(learnBtn);
      modal.appendChild(btnWrap);
    }

    // modalDom 在创建时（_createDomOverlay 里）内容还是空的，Phaser 用来做居中定位
    // 的宽高是那时候量出来的；这里内容全部塞完、高度被撑开之后，必须让 Phaser 重新
    // 量一次尺寸再居中，不然弹窗会按"创建时几乎是空的"那个高度去居中，看起来偏上/
    // 内容往下越长越偏。
    modalDom.updateSize();

    overlay.addEventListener('click', () => this._closeDetailModal());

    this._activeDetail = { overlayDom, modalDom };
  }

  _closeDetailModal() {
    if (!this._activeDetail) return;
    this._activeDetail.overlayDom.destroy();
    this._activeDetail.modalDom.destroy();
    this._activeDetail = null;
  }

  /**
   * "学习"确认后弹出的兵组选择器：列出所有还没学过这个技能的兵组（military.
   * hasLearnedSkill 判断），点击其中一个即让它学会该技能（military.learnSkill）。
   * 没有单独做成 SoldierSelector（military_ui.js 里已有的黑金风格选择器）是因为
   * 那个是黑金深色主题，这里的学派界面已经改成浅色主题了，样式对不上，所以按
   * 同样的浅色 THEME 自己写一个轻量版本。列表用原生 overflow-y:auto 滚动，
   * 不用再像 canvas 版本那样手动拼遮罩+wheel 事件。
   */
  showLearnUnitPicker(skillKey) {
    this._closePicker();

    const skill = MILITARY_SKILL[skillKey];
    const skillLevel = getSkillLevelInfo(skillKey)?.level ?? null;
    const candidates = Object.entries(this.saveData.military ?? {})
      .filter(([, soldier]) => !military.hasLearnedSkill(soldier, skillKey));

    const modalW = 420, modalH = 460;
    const { overlayDom, modalDom, overlay, modal } = this._createDomOverlay(modalW, modalH);
    modal.style.overflowY = 'hidden'; // 外层卡片不滚动，滚动交给下面的 list 自己滚

    // 拖滚动条手柄时监听要挂在 window 上（拖出手柄范围也要能继续跟着走），弹窗关闭
    // 时必须摘掉，不然每开一次弹窗就多一份泄漏的监听
    let windowPointerMove = null;
    let windowPointerUp = null;
    const closeModal = () => {
      if (windowPointerMove) window.removeEventListener('pointermove', windowPointerMove);
      if (windowPointerUp) window.removeEventListener('pointerup', windowPointerUp);
      overlayDom.destroy();
      modalDom.destroy();
      this._activePicker = null;
    };
    this._activePicker = { close: closeModal };

    modal.appendChild(this._buildDomCloseButton(closeModal));

    const title = document.createElement('div');
    title.textContent = `选择兵组学习【${skill?.name ?? skillKey}】`;
    title.style.cssText = `font-size:15px; font-weight:bold; color:${THEME.textPrimary}; text-align:center; padding:0 24px; margin-bottom:14px;`;
    modal.appendChild(title);

    if (candidates.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.textContent = '没有可以学习这个技能的兵组（可能都已经学过了，或者你还没有任何兵组）';
      emptyEl.style.cssText = `font-size:14px; color:${THEME.textDisabled}; text-align:center; line-height:1.6; padding:20px 10px;`;
      modal.appendChild(emptyEl);
    } else {
      // 原生 overflow-y:auto + scrollTop、以及只拦 wheel/在 list 上拖拽这两种做法，
      // 在这个项目的 Phaser DOM 容器里都实测滚不动，所以这里换成完全不依赖 flex
      // 自动分配高度、也不依赖浏览器原生滚动的做法：list 的高度是从弹窗固定高度里
      // 手动减掉 padding、标题高度算出来的具体像素值；内容放进 listInner，滚动直接
      // 改 listInner 的 translateY；右侧再加一条可以单独拖动的滚动条，作为滚轮和
      // 拖拽列表本身之外第三种、完全独立的操作方式。
      const listTop = title.offsetHeight + 14; // 14 = title 的 margin-bottom
      const listHeight = Math.max(60, modalH - 40 - listTop); // 40 = modal 上下 padding 各 20

      const list = document.createElement('div');
      list.style.cssText = `width:100%; height:${listHeight}px; position:relative; overflow:hidden; cursor:grab; touch-action:none;`;
      modal.appendChild(list);

      const listInner = document.createElement('div');
      listInner.style.cssText = `position:relative; padding-right:16px; box-sizing:border-box;`;
      list.appendChild(listInner);

      candidates.forEach(([id, soldier]) => {
        const unitName = MILITARY_UNIT[soldier.name]?.name ?? soldier.name;
        // 前置条件：学 N 级技能必须先学过本分支任意一个 N-1 级技能（1 级没有前置）
        const eligible = military.meetsSkillPrereq(soldier, skillKey);

        const row = document.createElement('div');
        row.style.cssText = `
          box-sizing:border-box; height:56px; margin-bottom:8px; padding:0 16px;
          background:${eligible ? '#f2f2f2' : '#e8e8e8'}; border:1px solid #d0d0d0; border-radius:4px;
          display:flex; flex-direction:column; justify-content:center;
          cursor:${eligible ? 'pointer' : 'not-allowed'};
        `;
        if (eligible) {
          row.addEventListener('mouseenter', () => { row.style.background = '#e6eef7'; });
          row.addEventListener('mouseleave', () => { row.style.background = '#f2f2f2'; });
        }

        const nameEl = document.createElement('div');
        nameEl.textContent = unitName;
        nameEl.style.cssText = `font-size:15px; font-weight:bold; color:${eligible ? THEME.textPrimary : THEME.textDisabled};`;
        const subEl = document.createElement('div');
        subEl.textContent = eligible
          ? `等级 ${soldier.level ?? 1}`
          : `需要先学会本分支任意一个 ${skillLevel != null ? skillLevel - 1 : '上一'}级技能`;
        subEl.style.cssText = `font-size:12px; color:${eligible ? THEME.textSecondary : THEME.danger}; margin-top:2px;`;
        row.appendChild(nameEl);
        row.appendChild(subEl);

        row.addEventListener('click', () => {
          if (dragMoved) return; // 拖拽经过这一行时不要顺带触发学习
          if (!eligible) {
            game.showTips(this.scene, `${unitName} 还不满足学习条件：需要先学会本分支任意一个 ${skillLevel != null ? skillLevel - 1 : '上一'}级技能`);
            return;
          }
          // 双重保险：学习按钮理论上在没有学院区/特区时已经不可点（见 showSkillDetail），
          // 这里再核实一次，和 AcademyViewer.upgradeCategory 的做法一致
          if (countAcademyDistricts(this.saveData.map?.grids) <= 0) {
            game.showTips(this.scene, '学派功能暂时锁定（没有已完工的学院区/特区），暂时无法学习');
            return;
          }

          const learnKey = `${id}_${skillKey}`;
          if (this._pendingLearnKeys.has(learnKey)) return; // 上一次点击的 addAction 还没返回，避免重复提交
          this._pendingLearnKeys.add(learnKey);

          // 学习技能消耗一格军事行动条，做法和 military_ui.js 里其它军事行动（征集物资/
          // 地形侦查）一致：actionList.military 里占一个坑位，坑位不够时 onFail 提示，
          // 真正的技能学习效果（learnedSkills/ability 变更）放在 onSuccess 里才执行。
          // config 里额外带上 schoolKey：行动列表（actionList.js）渲染这条记录时要显示
          // "开始学习XX学派的技能【YY】"，需要学派名，只靠 skillKey 反查不到对应的
          // 学派（getSkillLevelInfo 是本文件内部的私有缓存，没有导出），所以这里顺手
          // 把当前查看器自己持有的 schoolKey 一起存进 actionData。
          const actionKey = `academy_skill_learn_${id}_${skillKey}_${Date.now()}`;
          game.addAction('military', actionKey, { soldierId: id, skillKey, schoolKey: this.schoolKey }, {
            onSuccess: () => {
              this._pendingLearnKeys.delete(learnKey);
              const result = military.learnSkill(this.saveData, id, skillKey);
              saveSystem.save();
              closeModal();
              if (!result.ok) return; // 理论上不会发生：前置条件在点击前已经检查过
              game.showTips(this.scene, result.autoEquipped
                ? `${unitName} 已学会【${skill?.name ?? skillKey}】，并自动携带`
                : `${unitName} 已学会【${skill?.name ?? skillKey}】（携带栏已满，需要以后手动更换携带技能）`);
            },
            onFail: (info) => {
              this._pendingLearnKeys.delete(learnKey);
              if (info.reason === 'limit') {
                game.showTips(this.scene, '军事行动数量超过上限');
              }
            },
          });
        });

        listInner.appendChild(row);
      });

      // 必须等所有行都塞进 listInner 之后才能量出真实内容高度，用来算最大可滚动距离
      let scrollY = 0;
      const maxScrollY = Math.max(0, listInner.scrollHeight - listHeight);

      // 右侧滚动条：轨道 + 手柄，手柄高度按"可视区域/内容总高度"的比例算
      let handle = null;
      if (maxScrollY > 0) {
        const track = document.createElement('div');
        track.style.cssText = `position:absolute; top:0; right:0; width:6px; height:${listHeight}px; background:rgba(0,0,0,0.08); border-radius:3px; pointer-events:none;`;
        list.appendChild(track);

        const handleH = Math.max(30, listHeight * listHeight / listInner.scrollHeight);
        handle = document.createElement('div');
        handle.style.cssText = `position:absolute; top:0; right:0; width:6px; height:${handleH}px; background:#3a6ea5; border-radius:3px; cursor:pointer; pointer-events:auto;`;
        list.appendChild(handle);
      }

      const clampScroll = () => { scrollY = Math.max(0, Math.min(maxScrollY, scrollY)); };
      const applyScroll = () => {
        listInner.style.transform = `translateY(${-scrollY}px)`;
        if (handle) {
          const trackRange = listHeight - handle.offsetHeight;
          handle.style.top = `${trackRange > 0 ? (scrollY / maxScrollY) * trackRange : 0}px`;
        }
      };

      list.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollY += e.deltaY;
        clampScroll();
        applyScroll();
      }, { passive: false });

      let dragging = false, dragMoved = false, dragStartY = 0, dragStartScroll = 0;
      list.addEventListener('pointerdown', (e) => {
        if (e.target === handle) return; // 手柄自己单独处理拖拽，见下面
        dragging = true;
        dragMoved = false;
        dragStartY = e.clientY;
        dragStartScroll = scrollY;
      });
      list.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dy = dragStartY - e.clientY;
        if (Math.abs(dy) > 6) dragMoved = true;
        scrollY = dragStartScroll + dy;
        clampScroll();
        applyScroll();
      });
      const endDrag = () => { dragging = false; };
      list.addEventListener('pointerup', endDrag);
      list.addEventListener('pointerleave', endDrag);
      list.addEventListener('pointercancel', endDrag);

      if (handle) {
        let handleDragging = false, handleStartClientY = 0, handleStartScroll = 0;
        handle.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          handleDragging = true;
          handleStartClientY = e.clientY;
          handleStartScroll = scrollY;
        });
        windowPointerMove = (e) => {
          if (!handleDragging) return;
          const trackRange = listHeight - handle.offsetHeight;
          if (trackRange <= 0) return;
          const dy = e.clientY - handleStartClientY;
          scrollY = handleStartScroll + dy * (maxScrollY / trackRange);
          clampScroll();
          applyScroll();
        };
        windowPointerUp = () => { handleDragging = false; };
        window.addEventListener('pointermove', windowPointerMove);
        window.addEventListener('pointerup', windowPointerUp);
      }

      applyScroll();
    }

    // 这个弹窗虽然是固定高度，但保险起见同样在内容塞完后重新量一次尺寸再居中
    // （理由同 showSkillDetail 里的 modalDom.updateSize()）
    modalDom.updateSize();

    overlay.addEventListener('click', closeModal);
  }

  _closePicker() {
    if (this._activePicker) this._activePicker.close();
  }

  destroy() {
    // 全局输入监听必须手动摘掉，否则关闭后这些回调还会继续跑，
    // 引用到已经 destroy 掉的 contentContainer 会报错
    if (this._onPointerDown) this.scene.input.off('pointerdown', this._onPointerDown);
    if (this._onPointerMove) this.scene.input.off('pointermove', this._onPointerMove);
    if (this._onPointerUp) this.scene.input.off('pointerup', this._onPointerUp);
    if (this._onWheel) this.scene.input.off('wheel', this._onWheel);
    this._closeDetailModal();
    this._closePicker();
    if (this.mainContainer) this.mainContainer.destroy();
  }
}