import gi,json,time
gi.require_version('Atspi','2.0')
from gi.repository import Atspi
ids=set(json.load(open("/home/marco/Github/WebTech-RoadToUnina/docs/redesign-evidence/phase-6/assistive-owned-processes.json")))
apps=[]
desktop=Atspi.get_desktop(0)
for i in range(desktop.get_child_count()):
 app=desktop.get_child_at_index(i)
 if app.get_process_id() not in ids: continue
 nodes=[]; queue=[app]
 while queue and len(nodes)<500:
  node=queue.pop(0)
  try:
   nodes.append({'name':node.get_name(),'role':node.get_role_name(),'focused':node.get_state_set().contains(Atspi.StateType.FOCUSED)})
   queue.extend(node.get_child_at_index(j) for j in range(node.get_child_count()))
  except Exception: pass
 apps.append({'pid':app.get_process_id(),'nodes':nodes})
print(json.dumps({'ownedApplications':apps}))
