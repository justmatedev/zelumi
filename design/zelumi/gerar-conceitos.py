from pathlib import Path
from xml.sax.saxutils import escape
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

root=Path(__file__).resolve().parent
font=instantiateVariableFont(TTFont(root/'fonts/Manrope-wght.ttf'),{'wght':650},inplace=False)
glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); units=font['head'].unitsPerEm

def wordmark(x,y,size,color):
    pieces=[];cursor=0
    for char in 'zelumi':
        name=cmap[ord(char)];pen=SVGPathPen(glyphs);glyphs[name].draw(pen)
        pieces.append(f'<path d="{pen.getCommands()}" transform="translate({cursor} 0)"/>')
        cursor+=font['hmtx'].metrics[name][0]-12
    return f'<g fill="{color}" transform="translate({x} {y}) scale({size/units} {-size/units})">'+''.join(pieces)+'</g>'

symbols={
 '01-z-continuo': '<path d="M14 17H50L14 47H50" fill="none" stroke="COLOR" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
 '02-conversa': '<path d="M19 11H45A12 12 0 0 1 57 23V39A12 12 0 0 1 45 51H27L12 58V46A12 12 0 0 1 7 36V23A12 12 0 0 1 19 11Z" fill="none" stroke="COLOR" stroke-width="4.5" stroke-linejoin="round"/><path d="M22 24H42L22 38H42" fill="none" stroke="COLOR" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
 '03-horizonte': '<path d="M15 40A17 17 0 0 1 49 40" fill="none" stroke="COLOR" stroke-width="7" stroke-linecap="round"/><path d="M10 51H54" stroke="COLOR" stroke-width="7" stroke-linecap="round"/><path d="M32 6V12M10 15L15 20M54 15L49 20" stroke="COLOR" stroke-width="4.5" stroke-linecap="round"/>'
}
concepts=[
 ('01-z-continuo','01 / Z contínuo','Uma letra própria para a marca. Direto, discreto e fácil de reconhecer.'),
 ('02-conversa','02 / Conversa','Um Z dentro de um balão. Aproxima o símbolo da experiência com o bot.'),
 ('03-horizonte','03 / Horizonte','Luz surgindo no horizonte. Uma expressão mais acolhedora de clareza.')
]

def symbol(key,x,y,size,color):
    return f'<g transform="translate({x} {y}) scale({size/64})">'+symbols[key].replace('COLOR',color)+'</g>'

def svg(content,w,h,title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{escape(title)}"><title>{escape(title)}</title>'+content+'</svg>'

parts=['<rect width="1240" height="1100" fill="#EEE9E2"/>']
def label(x,y,text,size=14,color='#6D6159',weight=400):
    return f'<text x="{x}" y="{y}" fill="{color}" font-family="Noto Sans, sans-serif" font-size="{size}" font-weight="{weight}">{escape(text)}</text>'
parts+=[label(48,44,'ZELUMI  /  ESTUDOS DE IDENTIDADE',12,weight=600),label(48,98,'Uma marca para cuidar do cotidiano.',32,'#302721',600),label(48,132,'Laranja queimado · Manrope · aplicações nos temas claro e escuro',15)]
for index,(key,title,description) in enumerate(concepts):
    y=192+index*270
    parts.extend([label(48,y,title,21,'#302721',600),label(48,y+27,description,13)])
    for col,(theme,bg,ink,accent,border) in enumerate([('LIGHT','#FAF7F2','#302721','#B94B24','#DDD2C7'),('DARK','#191715','#F5EDE5','#F29B73','#403730')]):
        x=48+col*584;top=y+48
        parts.append(f'<rect x="{x}" y="{top}" width="560" height="174" rx="16" fill="{bg}" stroke="{border}"/>')
        parts.append(label(x+23,top+29,theme,10,accent,600))
        parts.append(symbol(key,x+63,top+66,62,accent))
        parts.append(wordmark(x+145,top+115,57,ink))
        parts.append(symbol(key,x+503,top+133,20,accent))
        output=root/'conceitos'/f'{key}-{theme.lower()}.svg'
        output.write_text(svg(symbol(key,8,8,64,accent)+wordmark(92,57,50,ink),360,80,f'Zelumi — {title} — {theme}'))
        (root/'conceitos'/f'{key}-simbolo-{theme.lower()}.svg').write_text(svg(symbol(key,0,0,64,accent),64,64,f'Símbolo Zelumi — {title}'))
parts.extend([label(48,1047,'PROPOSTAS PARA COMPARAÇÃO — NENHUM CONCEITO FOI ADOTADO NO SITE OU NO BOT.',11),label(48,1073,'O lettering usa Manrope em curvas vetoriais. Versões finais e ajustes ópticos vêm após a escolha.',12)])
(root/'comparacao.svg').write_text(svg(''.join(parts),1240,1100,'Zelumi — três propostas de logo nos temas claro e escuro'))
