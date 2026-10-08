"""Original LOOP prototype bag geometry, authored for this project.

Run: /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build-bags.py
Only the three leather maps and studio HDRI are third-party (Poly Haven, CC0).
GLB orientation is Y-up, front +Z. Units are preview units, not manufacturing measurements.
"""
import bpy, math, os
from mathutils import Vector
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / 'public' / 'assets'
OUT = ROOT / 'models'
OUT.mkdir(exist_ok=True)
SOURCE = PROJECT / 'assets-source'
REVIEW = PROJECT / 'docs' / 'asset-previews'
SOURCE.mkdir(exist_ok=True)
REVIEW.mkdir(exist_ok=True)

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def mat(name, color, rough=.45, metal=0, leather=False, albedo=False):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    if leather:
        texcoord=m.node_tree.nodes.new('ShaderNodeTexCoord')
        mapping=m.node_tree.nodes.new('ShaderNodeVectorMath'); mapping.operation='SCALE'; mapping.inputs[3].default_value=2
        m.node_tree.links.new(texcoord.outputs['UV'],mapping.inputs[0])
        for channel,colorspace in [('normal','Non-Color'),('roughness','Non-Color')] + ([('color','sRGB')] if albedo else []):
            image=m.node_tree.nodes.new('ShaderNodeTexImage')
            image.image=bpy.data.images.load(str(ROOT/'materials'/f'brown-leather-{channel}.jpg'),check_existing=True)
            image.image.colorspace_settings.name=colorspace
            m.node_tree.links.new(mapping.outputs[0],image.inputs['Vector'])
            if channel=='normal':
                n=m.node_tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.14
                m.node_tree.links.new(image.outputs['Color'],n.inputs['Color'])
                m.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
            else:
                m.node_tree.links.new(image.outputs['Color'],p.inputs['Roughness' if channel=='roughness' else 'Base Color'])
    return m

def smooth(obj):
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def mesh(name, verts, faces, material, uv=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    data.materials.append(material)
    if uv:
        layer=data.uv_layers.new()
        for poly in data.polygons:
            for li in poly.loop_indices:layer.data[li].uv=uv[data.loops[li].vertex_index]
    smooth(obj)
    return obj

def tube(name,pts,radius,material,closed=False):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=2
    data.bevel_depth=radius;data.bevel_resolution=3
    spline=data.splines.new('POLY');spline.points.add(len(pts)-1)
    for point,co in zip(spline.points,pts):point.co=(*co,1)
    spline.use_cyclic_u=closed
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.data.materials.append(material)
    return obj

def rounded(name,loc,scale,material,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Soft leather corners','BEVEL');b.width=bevel;b.segments=5
    o.data.materials.append(material);smooth(o)
    n=o.modifiers.new('Surface normals','WEIGHTED_NORMAL');n.keep_sharp=True
    return o

def torus(name,loc,major,minor,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=40,minor_segments=10,location=loc,rotation=rot)
    o=bpy.context.object;o.name=name;o.data.materials.append(material);smooth(o);return o

def stitch(name,pts,material,radius=.006,step=2):
    for i in range(0,len(pts)-1,step):tube(name,pts[i:i+2],radius,material)

def make_body(name,material,lining,width=4.4,depth=1.24,bottom=-1.7,top=.7,saddle=False):
    N=96;L=36;verts=[];faces=[];uv=[]
    for inner in range(2):
        for j in range(L+1):
            t=j/L
            if saddle:
                w=width*(.73+.27*math.sin(t*math.pi/2));d=depth*(.76+.24*math.sin(t*math.pi))
            else:
                w=width*(.84+.16*t);d=depth*(.77+.23*math.sin(t*math.pi*.85))
            if inner:w-=.08;d-=.08
            for k in range(N+1):
                a=2*math.pi*k/N;c=math.cos(a);s=math.sin(a)
                x=w/2*math.copysign(abs(c)**.38,c)
                y=d/2*math.copysign(abs(s)**.34,s)
                z=bottom+(top-bottom)*t
                z-=.075*abs(s)**4*t**6
                # restrained leather softness, most visible at side gussets
                y+=(.016*math.sin(t*13+x*1.8)+.01*math.sin(t*23-x))*math.sin(t*math.pi)*abs(c)**5
                if inner:z+=.035*(1-t)
                verts.append((x,y,z));uv.append((0,t*1.6))
            # Arc-length UVs avoid stretched grain at the broad front/back centers.
            start=len(verts)-(N+1)
            distance=[0]
            for k in range(1,N+1):
                pa,pb=Vector(verts[start+k-1]),Vector(verts[start+k])
                distance.append(distance[-1]+(pa-pb).length)
            for k in range(N+1):uv[start+k]=(distance[k]/distance[-1]*6,t*1.6)
    stride=N+1;offset=(L+1)*stride
    for inner in range(2):
        for j in range(L):
            for k in range(N):
                a=inner*offset+j*stride+k;f=(a,a+1,a+stride+1,a+stride)
                faces.append(f if not inner else tuple(reversed(f)))
    for k in range(N):
        a=L*stride+k;b=offset+a;faces.append((a,b,b+1,a+1))
        faces.append((k,k+1,offset+k+1,offset+k))
    faces.append(tuple(range(N-1,-1,-1)))
    faces.append(tuple(offset+k for k in range(N)))
    obj=mesh(name,verts,faces,material,uv);obj.data.materials.append(lining)
    for i,p in enumerate(obj.data.polygons):
        if L*N<=i<2*L*N or i==len(obj.data.polygons)-1:p.material_index=1
    return obj

def tote():
    clear()
    leather=mat('Cognac leather — Poly Haven normal and color',(.3,.11,.04),leather=True,albedo=True)
    edges=mat('Hand-painted leather edges',(.11,.038,.017),.39)
    lining=mat('Suede lining',(.095,.066,.045),.93)
    thread=mat('Saddle stitching',(.48,.3,.17),.81)
    gold=mat('Brushed warm brass',(.65,.4,.14),.22,.88)
    make_body('Tote / hollow leather shell',leather,lining)
    for side in [-1,1]:
        y=side*.57
        pts=[(2.16*math.cos(a),.53*math.copysign(abs(math.sin(a))**.34,math.sin(a)),.665-.075*abs(math.sin(a))**4) for a in [2*math.pi*i/128 for i in range(128)]]
        if side==1:tube('Rolled rim binding',pts,.03,edges,True)
        for x in [-1.28,1.28]:
            rounded('Handle attachment leather tab',(x,y,.3),(.25,.065,.68),leather,.06)
            for dx in [-.084,.084]:stitch('Hand stitch',[(x+dx,y+side*.041,-.015+i*.045) for i in range(14)],thread,.0045)
            torus('Handle brass ring',(x,y,.7),.105,.026,gold)
            for z in [.075,.5]:
                bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.03,location=(x,y+side*.041,z));bpy.context.object.scale=(1,.4,1);bpy.context.object.data.materials.append(gold)
        handle=[(-1.28*math.cos(math.pi*i/64),y+side*.015,.8+1.36*math.sin(math.pi*i/64)) for i in range(65)]
        tube('Rolled leather top handle',handle,.074,leather)
        stitch('Handle edge stitching',[(x,yy+side*.072,z) for x,yy,z in handle],thread,.0045)
    for sx in [-1,1]:
        seam=[]
        for i in range(56):
            t=i/55;x=sx*(1.67+.37*t);z=-1.6+2.14*t;y=-(.47+.12*math.sin(t*math.pi*.85))
            seam.append((x,y,z))
        tube('Side seam piping',seam,.019,edges)
        stitch('Side seam stitch',[(x-sx*.052,y-.025,z) for x,y,z in seam],thread,.005)
    # Quiet original hardware: no third-party marks or logos.
    rounded('Front signature brass plate',(0,-.618,-.12),(.36,.032,.072),gold,.017)
    rounded('Charm keeper leather tab',(1.77,-.61,.47),(.17,.08,.35),leather,.035)
    torus('CHARM_ANCHOR',(1.77,-.7,.68),.102,.025,gold)
    export('atelier-tote', [1.77,.68,.7])

def shoulder():
    clear()
    leather=mat('Ivory grained leather — Poly Haven scanned normal',(.68,.62,.51),.53,leather=True)
    edges=mat('Sand edge paint',(.30,.22,.14),.4)
    lining=mat('Dark suede interior',(.11,.075,.046),.92)
    thread=mat('Ivory stitching',(.76,.72,.64),.8)
    gold=mat('Champagne hardware',(.71,.53,.27),.2,.88)
    make_body('Shoulder / hollow rounded leather shell',leather,lining,width=3.82,depth=1.08,bottom=-1.7,top=.55,saddle=True)
    # Rounded sculpted flap with broad softened corners and a small brass lock.
    rounded('Soft front flap',(0,-.527,.05),(3.60,.125,1.13),leather,.25)
    flap=[]
    for i in range(25):flap.append((-1.61+i*3.22/24,-.61,-.43))
    stitch('Flap saddle stitch',flap,thread,.006)
    rounded('Magnetic clasp leather tongue',(0,-.64,-.42),(.29,.08,.56),leather,.07)
    rounded('Brushed clasp',(0,-.706,-.49),(.39,.055,.185),gold,.038)
    for x in [-1.79,1.79]:
        torus('Shoulder strap ring',(x,0,.54),.13,.034,gold)
        rounded('Side leather strap keeper',(x,.015,.30),(.19,.12,.38),leather,.045)
    strap=[(-1.78*math.cos(math.pi*i/80),.04,.71+1.70*math.sin(math.pi*i/80)) for i in range(81)]
    tube('Wide rolled shoulder strap',strap,.068,leather)
    stitch('Shoulder strap seam',[(x,y-.066,z) for x,y,z in strap],thread,.0045)
    for side in [-1,1]:
        seam=[]
        for i in range(64):
            t=i/63;seam.append((side*(1.42+.35*math.sin(t*math.pi/2)),-(.43+.06*math.sin(t*math.pi)),-1.57+t*1.99))
        tube('Side panel piping',seam,.016,edges)
    rounded('Charm keeper',(1.60,-.47,.50),(.15,.095,.34),leather,.03)
    torus('CHARM_ANCHOR',(1.62,-.60,.69),.104,.026,gold)
    export('atelier-shoulder', [1.62,.69,.60])

def export(name,anchor):
    # Convert curves and applied bevel geometry, then merge by material for modest draw calls.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.convert(target='MESH')
    bymat={}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and len(o.data.materials)==1:bymat.setdefault(o.data.materials[0].name,[]).append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for namepart,objs in bymat.items():
        for o in objs:o.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        if len(objs)>1:bpy.ops.object.join()
        bpy.context.object.name=namepart
        bpy.ops.object.select_all(action='DESELECT')
    a=bpy.data.objects.new('charm_attachment',None);bpy.context.collection.objects.link(a);a.location=(anchor[0],-anchor[2],anchor[1]);a['purpose']='Top attachment center in GLB preview coordinates'
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
    for im in bpy.data.images:
        if im.filepath and im.source=='FILE':im.filepath=bpy.path.relpath(bpy.path.abspath(im.filepath),start=str(SOURCE))
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f'{name}.blend'),compress=True)
    # Local review render is not shipped as a substitute for the interactive model.
    world=bpy.context.scene.world or bpy.data.worlds.new('Studio');bpy.context.scene.world=world;world.use_nodes=True
    nodes=world.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputWorld');bg=nodes.new('ShaderNodeBackground');env=nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(ROOT/'environment'/'studio-small-09-1k.hdr'));world.node_tree.links.new(env.outputs['Color'],bg.inputs[0]);world.node_tree.links.new(bg.outputs[0],out.inputs[0]);bg.inputs[1].default_value=.65
    bpy.ops.object.camera_add(location=(6,-10,5));camera=bpy.context.object;direction=Vector((0,0,.18))-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=6.2;bpy.context.scene.camera=camera
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=600;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(REVIEW/f'{name}-review.png');bpy.ops.render.render(write_still=True)

tote()
shoulder()
